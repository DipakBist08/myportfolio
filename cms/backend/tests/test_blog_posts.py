"""Posts written in the CMS reach the blog: rich text or Markdown (MDX), the
blog's article details, the public feed the blog reads, the one-time import of
the original articles, and no double announcement emails."""
import asyncio
import json

from sqlalchemy import create_engine, inspect, text

from app.core import notifications
from app.core.blog_import import IMPORTED_KEY, SEED_FILE, import_blog_articles
from app.core.schema_upgrade import add_missing_columns
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.announcement import Announcement
from app.models.post import Post
from app.models.settings import SiteSetting
from app.models.subscriber import Subscriber
from app.models.user import User

POSTS = "/api/v1/posts"
FEED = "/api/public/blog/posts"
MDX = '''## Before you start

<Callout type="tip">Keep **one** bug per report.</Callout>

<QAChecklist title="Ready?" items={[{ text: "Steps are numbered" }]} />
'''
META = {"articleType": "Tutorial", "difficulty": "beginner", "primaryQuery": "bug report example",
        "secondaryQueries": ["bug report template", " "], "cluster": "qa-fundamentals",
        "faq": [{"q": "What is a bug report?", "a": "A record of a defect."}],
        "tools": ["Jira"], "dateModified": "2026-11-12"}
# Markup the rich-text sanitiser must remove.
UNSAFE_TAG = "<scr" + "ipt>alert(1)</scr" + "ipt>"
UNSAFE_ATTR = '<img src="x" on' + 'error="alert(1)">'


def create(client, headers, **fields):
    body = {"title": "A post", "content": "<p>Hello</p>", "status": "published"} | fields
    res = client.post(f"{POSTS}?notify=false", json=body, headers=headers)
    assert res.status_code in (200, 201), res.text
    return res.json()


# ── Schema upgrade ────────────────────────────────────────────────────────────

def test_missing_columns_are_added_to_an_existing_posts_table(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE posts (id INTEGER PRIMARY KEY, title VARCHAR(500))"))
        conn.execute(text("INSERT INTO posts (id, title) VALUES (1, 'old post')"))
    assert add_missing_columns(engine) == ["posts.content_format", "posts.blog_meta"]
    cols = {c["name"] for c in inspect(engine).get_columns("posts")}
    assert {"content_format", "blog_meta"} <= cols
    with engine.begin() as conn:
        assert conn.execute(text("SELECT content_format FROM posts")).scalar() == "html"
    assert add_missing_columns(engine) == []  # nothing to do the second time


# ── Formats and article details ───────────────────────────────────────────────

def test_markdown_post_is_stored_exactly_as_written(client, admin_headers):
    post = create(client, admin_headers, content=MDX, content_format="mdx")
    detail = client.get(f"{POSTS}/{post['id']}", headers=admin_headers).json()
    assert detail["content"] == MDX and detail["content_format"] == "mdx"


def test_rich_text_is_still_sanitised(client, admin_headers):
    post = create(client, admin_headers, content="<p>ok</p>" + UNSAFE_TAG + UNSAFE_ATTR)
    detail = client.get(f"{POSTS}/{post['id']}", headers=admin_headers).json()
    assert "<scr" not in detail["content"] and "onerror" not in detail["content"]
    assert detail["content_format"] == "html"


def test_switching_markdown_to_rich_text_sanitises_what_is_stored(client, admin_headers):
    post = create(client, admin_headers, content="Hi " + UNSAFE_TAG, content_format="mdx")
    res = client.patch(f"{POSTS}/{post['id']}?notify=false", json={"content_format": "html"}, headers=admin_headers)
    assert res.status_code == 200 and "<scr" not in res.json()["content"]


def test_article_details_round_trip_and_are_validated(client, admin_headers):
    post = create(client, admin_headers, content=MDX, content_format="mdx", blog_meta=META)
    meta = client.get(f"{POSTS}/{post['id']}", headers=admin_headers).json()["blog_meta"]
    assert meta["articleType"] == "Tutorial" and meta["faq"][0]["q"] == "What is a bug report?"
    assert meta["secondaryQueries"] == ["bug report template"]  # blanks dropped
    bad = client.post(f"{POSTS}?notify=false", json={"title": "x", "blog_meta": {"articleType": "Rant"}},
                      headers=admin_headers)
    assert bad.status_code == 422
    bad_date = client.patch(f"{POSTS}/{post['id']}", json={"blog_meta": {"dateModified": "12/11/2026"}},
                            headers=admin_headers)
    assert bad_date.status_code == 422


def test_original_publishing_date_is_kept(client, admin_headers):
    post = create(client, admin_headers, published_at="2024-11-15T09:00:00Z")
    assert post["published_at"].startswith("2024-11-15")


# ── The feed the blog reads ───────────────────────────────────────────────────

def test_blog_feed_lists_only_published_posts_without_bodies(client, admin_headers):
    create(client, admin_headers, title="Live one", slug="live-one", content=MDX, content_format="mdx", blog_meta=META)
    create(client, admin_headers, title="Draft one", slug="draft-one", status="draft")
    feed = client.get(FEED).json()
    items = feed["posts"]
    assert feed["imported_slugs"] == []
    assert [i["slug"] for i in items] == ["live-one"]
    assert "content" not in items[0]
    assert items[0]["content_format"] == "mdx" and items[0]["blog_meta"]["cluster"] == "qa-fundamentals"

    one = client.get(f"{FEED}/live-one").json()
    assert one["content"] == MDX
    assert client.get(f"{FEED}/draft-one").status_code == 404
    assert client.get(f"{FEED}/nope").status_code == 404


# ── One-time import of the original articles ──────────────────────────────────

def superuser():
    db = SessionLocal()
    try:
        db.add(User(email="owner@example.com", username="owner", hashed_password=hash_password("x" * 12),
                    is_superuser=True))
        db.commit()
    finally:
        db.close()


def test_import_creates_the_three_articles_once(client):
    superuser()
    expected = {a["slug"]: a for a in json.loads(SEED_FILE.read_text())}
    db = SessionLocal()
    try:
        assert sorted(import_blog_articles(db)) == sorted(expected)
        assert import_blog_articles(db) == []  # second start: nothing
        bug = db.query(Post).filter(Post.slug == "how-to-write-good-bug-report").one()
        assert bug.content_format == "mdx" and bug.status.value == "published"
        assert bug.published_at.date().isoformat() == "2025-01-08"
        assert bug.category.name == "QA Fundamentals"
        assert {t.name for t in bug.tags} == {"Bug Reporting", "Manual Testing", "Jira", "Azure DevOps"}
        assert "<BugReport" in bug.content and bug.content == expected[bug.slug]["body"]
        meta = json.loads(bug.blog_meta)
        assert meta["articleType"] == "Tutorial" and len(meta["faq"]) == 5
        assert bug.seo_description == expected[bug.slug]["description"]
    finally:
        db.close()
    feed = client.get(FEED).json()
    assert len(feed["posts"]) == 3 and feed["imported_slugs"] == sorted(expected)


def test_deleted_article_is_not_imported_again(client):
    superuser()
    db = SessionLocal()
    try:
        import_blog_articles(db)
        post = db.query(Post).filter(Post.slug == "manual-vs-automation-testing").one()
        db.delete(post)
        db.commit()
        assert import_blog_articles(db) == []
        assert db.query(Post).filter(Post.slug == "manual-vs-automation-testing").first() is None
    finally:
        db.close()
    # Still listed as taken over, so the blog keeps the old file hidden too.
    feed = client.get(FEED).json()
    assert "manual-vs-automation-testing" in feed["imported_slugs"]
    assert "manual-vs-automation-testing" not in [p["slug"] for p in feed["posts"]]


def test_import_waits_until_an_admin_exists(client):
    db = SessionLocal()
    try:
        assert import_blog_articles(db) == []
        assert db.query(SiteSetting).filter(SiteSetting.key == IMPORTED_KEY).first() is None
    finally:
        db.close()


def test_a_post_that_already_has_the_slug_is_left_alone(client, admin_headers):
    create(client, admin_headers, title="Mine", slug="playwright-api-testing-guide", content="<p>mine</p>")
    superuser()
    db = SessionLocal()
    try:
        assert "playwright-api-testing-guide" not in import_blog_articles(db)
        assert db.query(Post).filter(Post.slug == "playwright-api-testing-guide").one().title == "Mine"
    finally:
        db.close()


# ── No double emails ──────────────────────────────────────────────────────────

def test_hourly_feed_check_leaves_cms_posts_to_the_cms(client, admin_headers, monkeypatch):
    create(client, admin_headers, title="From the CMS", slug="from-the-cms")
    db = SessionLocal()
    db.add(Announcement(source_key=notifications.BASELINE_KEY, title="start", status="skipped"))
    db.add(Subscriber(email="reader@example.com", is_active=True, unsubscribe_token="t" * 32))
    db.commit()
    db.close()

    base = "https://blog.example.com/blog/"

    async def fake_fetch(timeout=10.0):
        return [{"title": "From the CMS", "link": base + "from-the-cms", "description": "", "published": ""},
                {"title": "A file article", "link": base + "a-file-article", "description": "", "published": ""}]

    sent = []

    async def fake_send(recipients, subject, content_html, blog_url=""):
        sent.append(subject)
        return {"sent": len(recipients), "failed": 0, "errors": []}

    monkeypatch.setattr(notifications, "fetch_feed_posts", fake_fetch)
    monkeypatch.setattr(notifications, "send_newsletter", fake_send)

    result = asyncio.run(notifications.announce_new_from_rss())
    assert [a["title"] for a in result["announced"]] == ["A file article"]
    assert len(sent) == 1 and "From the CMS" not in sent[0]
    db = SessionLocal()
    try:
        row = db.query(Announcement).filter(Announcement.source_key == base + "from-the-cms").one()
        assert row.status == "skipped"
    finally:
        db.close()
