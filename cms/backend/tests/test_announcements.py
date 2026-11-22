"""New blog articles are emailed to subscribers automatically, once each.

The scheduled job calls POST /api/public/announcements/check. These tests
replace the blog feed and the sender, so nothing is fetched or emailed."""
import secrets

import pytest

from app.api.public import announcements
from app.core import notifications
from app.database import SessionLocal
from app.models.announcement import Announcement
from app.models.subscriber import Subscriber

CHECK = "/api/public/announcements/check"
BLOG = "https://blog.example.com/blog/"


def post(slug, title=None):
    return {"title": title or slug.replace("-", " ").title(), "link": BLOG + slug,
            "description": "About " + slug, "published": ""}


@pytest.fixture
def feed(client, monkeypatch):
    """The blog feed, newest first, as the real RSS lists it."""
    items = [post("bug-reports"), post("playwright-api"), post("manual-vs-automation")]

    async def fake_fetch(timeout=10.0):
        if isinstance(items, Exception):
            raise items
        return list(items)

    monkeypatch.setattr(notifications, "fetch_feed_posts", fake_fetch)
    announcements._last_check = 0.0
    return items


@pytest.fixture
def outbox(monkeypatch):
    """Records each announcement instead of sending it."""
    class Outbox(list):
        fail = False

    box = Outbox()

    async def fake_send(recipients, subject, content_html, blog_url=""):
        emails = [r["email"] for r in recipients]
        if box.fail:
            return {"sent": 0, "failed": len(emails), "errors": ["Resend is down"]}
        box.append({"subject": subject, "to": emails, "html": content_html})
        return {"sent": len(emails), "failed": 0, "errors": []}

    monkeypatch.setattr(notifications, "send_newsletter", fake_send)
    return box


def subscriber(email, **fields):
    db = SessionLocal()
    db.add(Subscriber(email=email, is_active=fields.pop("is_active", True),
                      unsubscribe_token=secrets.token_urlsafe(16), **fields))
    db.commit()
    db.close()


def check(client):
    announcements._last_check = 0.0  # the one-a-minute limit has its own test
    res = client.post(CHECK)
    assert res.status_code == 200, res.text
    return res.json()


def status_of(link):
    db = SessionLocal()
    try:
        row = db.query(Announcement).filter(Announcement.source_key == link).first()
        return row.status if row else None
    finally:
        db.close()


def test_the_first_check_does_not_email_anyone_about_existing_articles(client, feed, outbox):
    subscriber("reader@example.com")
    assert check(client) == {"started": True, "existing_articles_not_announced": 3}
    assert outbox == []
    assert check(client) == {"announced": []}
    assert outbox == []


def test_a_new_article_is_emailed_to_subscribers_once(client, feed, outbox):
    subscriber("reader@example.com")
    subscriber("other@example.com")
    check(client)
    feed.insert(0, post("flaky-tests", "Taming flaky tests"))

    assert check(client) == {"announced": [{"title": "Taming flaky tests", "status": "sent"}]}
    assert len(outbox) == 1
    assert outbox[0]["subject"] == "Taming flaky tests"
    assert sorted(outbox[0]["to"]) == ["other@example.com", "reader@example.com"]
    assert BLOG + "flaky-tests" in outbox[0]["html"]

    assert check(client) == {"announced": []}
    assert len(outbox) == 1


def test_only_people_on_the_list_get_it(client, feed, outbox):
    subscriber("reader@example.com")
    subscriber("left@example.com", is_active=False, is_unsubscribed=True)
    subscriber("pending@example.com", is_active=False)
    check(client)
    feed.insert(0, post("new-article"))
    check(client)
    assert outbox[0]["to"] == ["reader@example.com"]


def test_several_new_articles_go_out_oldest_first(client, feed, outbox):
    subscriber("reader@example.com")
    check(client)
    feed[0:0] = [post("third"), post("second")]  # newest first, like the feed
    result = check(client)
    assert [a["title"] for a in result["announced"]] == ["Second", "Third"]
    assert [m["subject"] for m in outbox] == ["Second", "Third"]


def test_a_sudden_flood_of_new_articles_is_not_emailed(client, feed, outbox):
    subscriber("reader@example.com")
    check(client)
    feed[0:0] = [post(f"moved-{i}") for i in range(notifications.MAX_NEW_PER_CHECK + 1)]
    result = check(client)
    assert "skipped" in result and outbox == []
    assert status_of(BLOG + "moved-0") == "skipped"
    assert check(client) == {"announced": []}


def test_a_failed_send_is_tried_again_on_the_next_check(client, feed, outbox):
    subscriber("reader@example.com")
    check(client)
    feed.insert(0, post("new-article"))
    outbox.fail = True
    assert check(client)["announced"][0]["status"] == "failed"
    outbox.fail = False
    assert check(client)["announced"][0]["status"] == "sent"
    assert len(outbox) == 1


def test_an_article_published_before_anyone_subscribed_is_not_sent_later(client, feed, outbox):
    check(client)
    feed.insert(0, post("early-article"))
    assert check(client)["announced"][0]["status"] == "skipped"
    subscriber("reader@example.com")
    assert check(client) == {"announced": []}
    assert outbox == []


def test_an_unreadable_feed_changes_nothing(client, feed, outbox, monkeypatch):
    async def broken(timeout=10.0):
        raise RuntimeError("blog is down")
    monkeypatch.setattr(notifications, "fetch_feed_posts", broken)
    assert check(client) == {"error": "could not read the blog feed"}
    assert status_of(notifications.BASELINE_KEY) is None


def test_an_old_failed_manual_announcement_is_not_retried_by_the_first_check(client, feed, outbox):
    db = SessionLocal()
    db.add(Announcement(source_key=BLOG + "bug-reports", title="Bug Reports", status="failed"))
    db.commit()
    db.close()
    subscriber("reader@example.com")
    check(client)
    assert status_of(BLOG + "bug-reports") == "skipped"
    assert check(client) == {"announced": []} and outbox == []


def test_the_answer_never_names_subscribers(client, feed, outbox):
    subscriber("reader@example.com")
    check(client)
    feed.insert(0, post("new-article"))
    announcements._last_check = 0.0
    res = client.post(CHECK)
    assert "@" not in res.text and "sent" in res.text
    assert "recipients" not in res.text


def test_checks_are_limited_to_one_a_minute(client, feed, outbox):
    announcements._last_check = 0.0
    assert client.post(CHECK).status_code == 200
    res = client.post(CHECK)
    assert res.status_code == 429 and res.headers["Retry-After"] == "60"
