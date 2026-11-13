"""Visit counting, post readers, comment reactions and the admin traffic view."""
import json

from conftest import BROWSER, visitor

from app.database import SessionLocal
from app.models.traffic import PageView


def track(client, ip, **body):
    payload = {"site": "blog", "path": "/blog/a-post", "slug": "a-post", "title": "A post"} | body
    # Sent as text/plain, the way navigator.sendBeacon sends it.
    return client.post("/api/public/track", content=json.dumps(payload),
                       headers=visitor(ip) | {"Content-Type": "text/plain;charset=UTF-8"})


# ----- visits ----------------------------------------------------------------

def test_a_view_is_counted_once_per_visitor_per_page_within_half_an_hour(client):
    first = track(client, "203.0.113.1")
    assert first.status_code == 200
    assert first.json() == {"counted": True, "slug": "a-post", "views": 1, "readers": 1}
    again = track(client, "203.0.113.1")  # a reload
    assert again.json()["counted"] is False and again.json()["views"] == 1
    other = track(client, "203.0.113.2")  # someone else
    assert other.json() | {} == {"counted": True, "slug": "a-post", "views": 2, "readers": 2}
    assert client.get("/api/public/stats/post", params={"slug": "a-post"}).json() == {"slug": "a-post", "views": 2, "readers": 2}


def test_crawlers_and_link_previews_are_not_counted(client):
    for agent in ["Googlebot/2.1", "facebookexternalhit/1.1", "Mozilla/5.0 HeadlessChrome/120", "curl/8.0", ""]:
        r = client.post("/api/public/track", json={"site": "portfolio", "path": "/"}, headers=visitor("198.51.100.7", agent))
        assert r.json() == {"counted": False}, agent
    db = SessionLocal()
    assert db.query(PageView).count() == 0
    db.close()


def test_no_address_or_full_referrer_is_stored(client):
    track(client, "203.0.113.9", referrer="https://www.linkedin.com/feed/some/private/path?x=1")
    db = SessionLocal()
    row = db.query(PageView).one()
    db.close()
    assert row.referrer_host == "www.linkedin.com"
    assert "203.0.113.9" not in (row.visitor_hash + row.path + row.title)
    assert len(row.visitor_hash) == 32


def test_bad_input_is_refused(client):
    assert client.post("/api/public/track", json={"site": "elsewhere", "path": "/"}, headers=visitor("1.1.1.1")).status_code == 422
    assert client.post("/api/public/track", json={"site": "blog", "path": "no-slash"}, headers=visitor("1.1.1.1")).status_code == 422
    assert client.post("/api/public/track", json={"site": "blog", "path": "/", "slug": "../etc"}, headers=visitor("1.1.1.1")).status_code == 422
    assert client.post("/api/public/track", content="x" * 5000, headers=visitor("1.1.1.1")).status_code == 413
    assert client.get("/api/public/stats/post", params={"slug": "Bad Slug"}).status_code == 422


def test_title_is_stored_as_plain_text(client):
    track(client, "203.0.113.3", title="<script>alert(1)</script>Q&A | Playwright & API")
    db = SessionLocal()
    assert db.query(PageView).one().title == "alert(1)Q&A | Playwright & API"
    db.close()


def test_comment_text_keeps_ampersands_but_loses_tags(client):
    r = client.post("/api/public/comments", json={"post_slug": "a-post", "author_name": "Reader",
        "author_email": "r@example.com", "content": "<b>Q&A</b> 3 < 4"}, headers=visitor("192.0.2.77"))
    assert r.json()["content"] == "Q&A 3 < 4"


# ----- reactions ---------------------------------------------------------------

def make_comment(client, parent_id=None):
    r = client.post("/api/public/comments", json={
        "post_slug": "a-post", "parent_id": parent_id, "author_name": "Reader",
        "author_email": "reader@example.com", "content": "Useful, thanks.",
    }, headers=visitor("192.0.2.50"))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def react(client, comment_id, value, ip):
    return client.post(f"/api/public/comments/{comment_id}/reaction", json={"value": value}, headers=visitor(ip))


def test_like_dislike_switch_and_clear(client):
    cid = make_comment(client)
    assert react(client, cid, 1, "10.0.0.1").json() == {"comment_id": cid, "likes": 1, "dislikes": 0, "my_reaction": 1}
    assert react(client, cid, 1, "10.0.0.1").json()["likes"] == 1  # liking twice is still one like
    assert react(client, cid, -1, "10.0.0.2").json() == {"comment_id": cid, "likes": 1, "dislikes": 1, "my_reaction": -1}
    assert react(client, cid, -1, "10.0.0.1").json() == {"comment_id": cid, "likes": 0, "dislikes": 2, "my_reaction": -1}
    assert react(client, cid, 0, "10.0.0.1").json() == {"comment_id": cid, "likes": 0, "dislikes": 1, "my_reaction": 0}
    assert react(client, cid, 2, "10.0.0.1").status_code == 422
    assert react(client, 99999, 1, "10.0.0.1").status_code == 404


def test_comments_carry_counts_and_the_readers_own_reaction(client):
    top = make_comment(client)
    reply = make_comment(client, parent_id=top)
    react(client, top, 1, "10.0.0.1")
    react(client, top, 1, "10.0.0.2")
    react(client, reply, -1, "10.0.0.1")

    mine = client.get("/api/public/comments", params={"slug": "a-post"}, headers=visitor("10.0.0.1")).json()
    assert (mine[0]["likes"], mine[0]["dislikes"], mine[0]["my_reaction"]) == (2, 0, 1)
    assert (mine[0]["replies"][0]["likes"], mine[0]["replies"][0]["dislikes"], mine[0]["replies"][0]["my_reaction"]) == (0, 1, -1)

    stranger = client.get("/api/public/comments", params={"slug": "a-post"}, headers=visitor("10.0.0.9")).json()
    assert stranger[0]["my_reaction"] == 0 and stranger[0]["likes"] == 2


def test_reactions_go_when_the_comment_is_deleted(client, admin_headers):
    cid = make_comment(client)
    react(client, cid, 1, "10.0.0.1")
    assert client.delete(f"/api/v1/comments/{cid}", headers=admin_headers).status_code == 204
    from app.models.traffic import CommentReaction
    db = SessionLocal()
    assert db.query(CommentReaction).count() == 0
    db.close()


def test_comment_rate_limit_is_per_visitor_not_per_proxy(client):
    def comment(ip):
        return client.post("/api/public/comments", json={
            "post_slug": "a-post", "author_name": "Reader", "author_email": "r@example.com", "content": "Hello there",
        }, headers=visitor(ip)).status_code

    assert [comment("192.0.2.1") for _ in range(6)] == [201] * 5 + [429]
    assert comment("192.0.2.2") == 201  # a different reader behind the same proxy is unaffected


def test_reactions_are_rate_limited(client):
    cid = make_comment(client)
    codes = [react(client, cid, 1 if i % 2 else -1, "10.9.9.9").status_code for i in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429


# ----- admin -------------------------------------------------------------------

def test_admin_traffic_needs_a_login(client):
    assert client.get("/api/v1/analytics/traffic").status_code == 401


def test_admin_traffic_summarises_visits_posts_and_reactions(client, admin_headers):
    track(client, "203.0.113.1")
    track(client, "203.0.113.2")
    track(client, "203.0.113.1", slug="other-post", path="/blog/other-post", title="Other post")
    client.post("/api/public/track", json={"site": "portfolio", "path": "/", "title": "Dipak Bist"}, headers=visitor("203.0.113.1"))
    cid = make_comment(client)
    react(client, cid, 1, "10.0.0.1")
    react(client, cid, -1, "10.0.0.2")

    t = client.get("/api/v1/analytics/traffic", params={"days": 7, "tz_offset": 345}, headers=admin_headers).json()
    assert (t["visits_total"], t["visitors_total"]) == (4, 2)
    assert (t["visits_today"], t["visitors_today"]) == (4, 2)
    assert (t["visits_period"], t["visitors_period"]) == (4, 2)
    assert len(t["chart"]) == 7 and t["chart"][-1] == {"day": t["today"], "visits": 4, "visitors": 2}
    assert {s["site"]: (s["visits"], s["visitors"]) for s in t["by_site"]} == {"blog": (3, 2), "portfolio": (1, 1)}
    assert t["top_pages"][0] == {"site": "blog", "path": "/blog/a-post", "title": "A post", "visits": 2, "visitors": 2}
    posts = {p["slug"]: p for p in t["posts"]}
    assert posts["a-post"] == {"slug": "a-post", "title": "A post", "views": 2, "readers": 2, "comments": 1, "likes": 1, "dislikes": 1}
    assert posts["other-post"]["views"] == 1 and posts["other-post"]["comments"] == 0


def test_admin_comment_list_shows_reactions(client, admin_headers):
    cid = make_comment(client)
    react(client, cid, 1, "10.0.0.1")
    listed = client.get("/api/v1/comments", headers=admin_headers).json()
    assert (listed[0]["likes"], listed[0]["dislikes"]) == (1, 0)
