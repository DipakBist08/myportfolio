"""Blog readers: Google sign-in, claps, signed-in comments and the numbers
behind the "Recommended from" cards."""
import time

import jwt
from conftest import BLOG, FakeGoogle, session_cookie, sign_in, visitor

from app.database import SessionLocal
from app.models.reader import CommentAuthor, PostClap, Reader


def google_sign_in(client, credential, origin=BLOG, ip="192.0.2.10"):
    return client.post("/api/public/auth/google", json={"credential": credential},
                       headers=visitor(ip) | {"Origin": origin})


# ----- sign-in -------------------------------------------------------------------

def test_signing_in_with_google_creates_the_reader_and_sets_a_private_session_cookie(client, google):
    r = google_sign_in(client, google.token(sub="42", name="Asha Reader", email="asha@example.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reader"]["name"] == "Asha Reader"
    assert body["reader"]["picture"] == "https://lh3.googleusercontent.com/a/42=s96-c"
    assert "email" not in body["reader"]  # the email address is never sent back to the page
    assert r.headers["cache-control"] == "no-store"

    cookie = session_cookie(r)
    assert cookie["httponly"] is True
    assert cookie["samesite"].lower() == "lax"
    assert cookie["path"] == "/api/public"
    assert cookie["secure"] is True
    assert int(cookie["max-age"]) == 30 * 24 * 3600

    db = SessionLocal()
    reader = db.query(Reader).one()
    assert (reader.google_sub, reader.email, reader.name) == ("42", "asha@example.com", "Asha Reader")
    db.close()


def test_me_says_who_is_signed_in(client, google):
    assert client.get("/api/public/auth/me").json() == {"reader": None, "sign_in": True}
    headers = sign_in(client, google, sub="7", name="Ravi")
    me = client.get("/api/public/auth/me", headers=headers).json()
    assert me["reader"]["name"] == "Ravi" and me["sign_in"] is True


def test_signing_in_again_updates_the_same_reader(client, google):
    sign_in(client, google, sub="9", name="Old Name")
    sign_in(client, google, sub="9", name="New Name", email="new@example.com")
    db = SessionLocal()
    readers = db.query(Reader).all()
    assert len(readers) == 1 and (readers[0].name, readers[0].email) == ("New Name", "new@example.com")
    db.close()


def test_tokens_that_are_not_valid_google_id_tokens_for_this_app_are_refused(client, google):
    stranger = FakeGoogle()  # right shape, wrong key
    bad = {
        "another app's token": google.token(aud="someone-else.apps.googleusercontent.com"),
        "wrong issuer": google.token(iss="https://evil.example.com"),
        "expired": google.token(iat=int(time.time()) - 7200, exp=int(time.time()) - 3600),
        "unverified email": google.token(email_verified=False),
        "no email": google.token(email=None),
        "signed by someone else": google.token(key=stranger.private_key),
        "not a JWT": "x" * 40,
    }
    for case, credential in bad.items():
        r = google_sign_in(client, credential)
        assert r.status_code == 401, case
        assert "set-cookie" not in r.headers, case
    db = SessionLocal()
    assert db.query(Reader).count() == 0
    db.close()


def test_sign_in_is_off_until_a_google_client_id_is_set(client, google, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    assert google_sign_in(client, google.token()).status_code == 503
    assert client.get("/api/public/auth/me").json()["sign_in"] is False
    assert client.get("/health").json()["reader_sign_in"] == "off"
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    assert client.get("/health").json()["reader_sign_in"] == "on"


def test_sign_in_from_another_site_is_refused(client, google):
    assert google_sign_in(client, google.token(), origin="https://evil.example.com").status_code == 403


def test_sign_in_attempts_are_rate_limited(client, google):
    codes = [google_sign_in(client, "y" * 40, ip="198.51.100.4").status_code for _ in range(11)]
    assert codes == [401] * 10 + [429]


def test_signing_out_clears_the_cookie(client, google):
    headers = sign_in(client, google)
    r = client.post("/api/public/auth/logout", headers=headers)
    assert r.status_code == 204
    assert session_cookie(r)["value"] == ""


def test_a_reader_session_is_not_an_admin_token_and_an_admin_token_is_not_a_reader_session(client, google, admin_headers):
    reader = sign_in(client, google)
    reader_token = reader["Cookie"].split("=", 1)[1]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {reader_token}"}).status_code == 401

    admin_token = admin_headers["Authorization"].split(" ", 1)[1]
    as_reader = {"Origin": BLOG, "Cookie": f"reader_session={admin_token}"}
    assert client.get("/api/public/auth/me", headers=as_reader).json()["reader"] is None
    assert client.post("/api/public/claps", json={"slug": "a-post", "count": 1}, headers=as_reader).status_code == 401


def test_a_tampered_session_is_ignored(client, google):
    headers = sign_in(client, google)
    token = headers["Cookie"].split("=", 1)[1]
    claims = jwt.decode(token, options={"verify_signature": False})
    forged = jwt.encode(claims | {"sub": "999"}, "not-the-key-" * 4, algorithm="HS256")
    assert client.get("/api/public/auth/me", headers={"Cookie": f"reader_session={forged}"}).json()["reader"] is None


# ----- claps ---------------------------------------------------------------------

def clap(client, headers, count=1, slug="a-post"):
    return client.post("/api/public/claps", json={"slug": slug, "count": count}, headers=headers)


def test_clapping_needs_a_sign_in(client):
    r = client.post("/api/public/claps", json={"slug": "a-post", "count": 1}, headers={"Origin": BLOG})
    assert r.status_code == 401
    assert r.json()["detail"] == "Sign in with Google to do that."


def test_each_reader_claps_once_and_the_post_counts_readers(client, google):
    """The owner's rule (22/11/2026): one clap per reader; clapping again changes nothing."""
    asha = sign_in(client, google, sub="1", ip="192.0.2.1")
    ravi = sign_in(client, google, sub="2", ip="192.0.2.2")

    assert clap(client, asha).json() == {"slug": "a-post", "claps": 1, "clappers": 1, "my_claps": 1, "max_claps": 1}
    for _ in range(5):
        assert clap(client, asha).json()["claps"] == 1  # still one clap from Asha
    no_count = client.post("/api/public/claps", json={"slug": "a-post"}, headers=ravi)  # count is optional
    assert no_count.json() == {"slug": "a-post", "claps": 2, "clappers": 2, "my_claps": 1, "max_claps": 1}

    assert client.get("/api/public/claps", params={"slug": "a-post"}).json() == {
        "slug": "a-post", "claps": 2, "clappers": 2, "my_claps": 0, "max_claps": 1,
    }
    assert client.get("/api/public/claps", params={"slug": "a-post"}, headers=ravi).json()["my_claps"] == 1
    assert client.get("/api/public/claps", params={"slug": "a-post"}).headers["cache-control"] == "no-store"


def test_claps_saved_before_the_one_clap_rule_count_once(client, google):
    """Rows from the earlier Medium-style version (up to 50 per reader) count as one clap."""
    asha = sign_in(client, google, sub="1", ip="192.0.2.1")
    db = SessionLocal()
    db.add(PostClap(post_slug="a-post", reader_id=db.query(Reader).one().id, count=33))
    db.commit()
    db.close()
    assert client.get("/api/public/claps", params={"slug": "a-post"}, headers=asha).json() == {
        "slug": "a-post", "claps": 1, "clappers": 1, "my_claps": 1, "max_claps": 1,
    }
    assert client.get("/api/public/engagement", params={"slugs": "a-post"}).json()["posts"]["a-post"]["claps"] == 1
    assert clap(client, asha).json()["claps"] == 1


def test_a_reader_can_take_their_clap_back(client, google):
    asha = sign_in(client, google, sub="1", ip="192.0.2.1")
    ravi = sign_in(client, google, sub="2", ip="192.0.2.2")
    clap(client, asha)
    clap(client, ravi)
    r = client.delete("/api/public/claps", params={"slug": "a-post"}, headers=asha)
    assert r.json() == {"slug": "a-post", "claps": 1, "clappers": 1, "my_claps": 0, "max_claps": 1}
    assert clap(client, asha).json()["claps"] == 2  # and clap again


def test_bad_clap_requests_are_refused(client, google):
    asha = sign_in(client, google)
    assert clap(client, asha, 0).status_code == 422
    assert clap(client, asha, 2).status_code == 422  # one clap per reader
    assert clap(client, asha, 1, slug="../etc/passwd").status_code == 422
    assert client.get("/api/public/claps", params={"slug": "Not A Slug"}).status_code == 422


def test_claps_from_another_site_are_refused(client, google):
    asha = sign_in(client, google)
    assert clap(client, asha | {"Origin": "https://evil.example.com"}).status_code == 403


def test_claps_are_rate_limited_per_reader(client, google):
    asha = sign_in(client, google)
    codes = [clap(client, asha).status_code for _ in range(61)]
    assert codes[:60] == [200] * 60 and codes[60] == 429


# ----- comments ------------------------------------------------------------------

def comment(client, headers, content="Useful, thanks.", parent_id=None, slug="a-post"):
    return client.post("/api/public/comments", json={"post_slug": slug, "parent_id": parent_id, "content": content},
                       headers=headers)


def test_commenting_needs_a_sign_in(client):
    r = client.post("/api/public/comments", json={
        "post_slug": "a-post", "author_name": "Anon", "author_email": "a@example.com", "content": "Hi",
    }, headers=visitor("192.0.2.3") | {"Origin": BLOG})
    assert r.status_code == 401


def test_a_comment_carries_the_google_name_and_picture_and_keeps_the_email_private(client, google):
    asha = sign_in(client, google, sub="5", name="Asha Reader", email="asha@example.com")
    r = comment(client, asha | {"Content-Type": "application/json"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["author_name"] == "Asha Reader"
    assert body["author_picture"] == "https://lh3.googleusercontent.com/a/5=s96-c"
    assert "author_email" not in body

    # A name or email in the request is ignored: they come from the Google account.
    spoof = client.post("/api/public/comments", json={
        "post_slug": "a-post", "content": "Me again", "author_name": "Dipak Bist", "author_email": "x@example.com",
    }, headers=asha)
    assert spoof.json()["author_name"] == "Asha Reader"

    listed = client.get("/api/public/comments", params={"slug": "a-post"}).json()
    assert [c["author_picture"] for c in listed] == ["https://lh3.googleusercontent.com/a/5=s96-c"] * 2

    db = SessionLocal()
    from app.models.comment import Comment
    assert {c.author_email for c in db.query(Comment).all()} == {"asha@example.com"}
    assert db.query(CommentAuthor).count() == 2
    db.close()


def test_replies_from_signed_in_readers(client, google):
    asha = sign_in(client, google, sub="1", name="Asha", ip="192.0.2.1")
    ravi = sign_in(client, google, sub="2", name="Ravi", ip="192.0.2.2")
    top = comment(client, asha).json()["id"]
    reply = comment(client, ravi, "Agreed.", parent_id=top)
    assert reply.status_code == 201
    listed = client.get("/api/public/comments", params={"slug": "a-post"}).json()
    assert listed[0]["replies"][0]["author_name"] == "Ravi"
    assert listed[0]["replies"][0]["author_picture"].endswith("/2=s96-c")
    assert comment(client, ravi, "Orphan", parent_id=99999).status_code == 404


def test_comments_from_another_site_are_refused(client, google):
    asha = sign_in(client, google)
    assert comment(client, asha | {"Origin": "https://evil.example.com"}).status_code == 403


def test_comments_need_a_real_post_slug(client, google):
    asha = sign_in(client, google)
    assert comment(client, asha, slug="Bad Slug!").status_code == 422


def test_comments_written_before_sign_in_still_show(client):
    from app.models.comment import Comment

    db = SessionLocal()
    db.add(Comment(post_slug="a-post", author_name="Early Reader", author_email="e@example.com", content="First!"))
    db.commit()
    db.close()
    listed = client.get("/api/public/comments", params={"slug": "a-post"}).json()
    assert (listed[0]["author_name"], listed[0]["author_picture"]) == ("Early Reader", "")


def test_comment_rate_limit_is_per_reader(client, google):
    asha = sign_in(client, google, sub="1", ip="192.0.2.1")
    ravi = sign_in(client, google, sub="2", ip="192.0.2.2")
    assert [comment(client, asha, f"Note {i}").status_code for i in range(6)] == [201] * 5 + [429]
    assert comment(client, ravi).status_code == 201


def test_deleting_a_comment_removes_its_author_link(client, google, admin_headers):
    asha = sign_in(client, google)
    cid = comment(client, asha).json()["id"]
    assert client.delete(f"/api/v1/comments/{cid}", headers=admin_headers).status_code == 204
    db = SessionLocal()
    assert db.query(CommentAuthor).count() == 0
    assert db.query(Reader).count() == 1  # the reader stays
    db.close()


# ----- recommendation numbers ----------------------------------------------------

def test_engagement_gives_claps_comments_and_readers_for_several_posts(client, google):
    asha = sign_in(client, google, sub="1", ip="192.0.2.1")
    ravi = sign_in(client, google, sub="2", ip="192.0.2.2")
    clap(client, asha, slug="post-one")
    clap(client, ravi, slug="post-one")
    top = comment(client, asha, slug="post-one").json()["id"]
    comment(client, ravi, "Reply", parent_id=top, slug="post-one")
    for ip in ("203.0.113.1", "203.0.113.2", "203.0.113.1"):
        client.post("/api/public/track", json={"site": "blog", "path": "/blog/post-one", "slug": "post-one", "title": "One"},
                    headers=visitor(ip))

    r = client.get("/api/public/engagement", params={"slugs": "post-one,post-two"})
    assert r.json() == {"posts": {
        "post-one": {"claps": 2, "comments": 2, "readers": 2},
        "post-two": {"claps": 0, "comments": 0, "readers": 0},
    }}


def test_engagement_refuses_bad_or_too_many_slugs(client):
    assert client.get("/api/public/engagement", params={"slugs": ""}).status_code == 422
    assert client.get("/api/public/engagement", params={"slugs": "ok,Not OK"}).status_code == 422
    many = ",".join(f"post-{i}" for i in range(25))
    assert client.get("/api/public/engagement", params={"slugs": many}).status_code == 422


def test_a_reader_leaving_takes_their_clap_with_them(client, google):
    asha = sign_in(client, google)
    clap(client, asha)
    db = SessionLocal()
    db.delete(db.query(Reader).one())
    db.commit()
    assert db.query(PostClap).count() == 0
    db.close()


# ----- before Google sign-in is switched on --------------------------------------

def test_until_sign_in_is_on_comments_take_a_name_and_email_as_before(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    headers = visitor("192.0.2.30") | {"Origin": BLOG}
    r = client.post("/api/public/comments", json={
        "post_slug": "a-post", "author_name": "<b>Early</b> Reader", "author_email": "early@example.com", "content": "Hi",
    }, headers=headers)
    assert r.status_code == 201, r.text
    assert (r.json()["author_name"], r.json()["author_picture"]) == ("Early Reader", "")
    reply = client.post("/api/public/comments", json={
        "post_slug": "a-post", "parent_id": r.json()["id"], "author_name": "Second",
        "author_email": "s@example.com", "content": "Yes",
    }, headers=headers)
    assert reply.status_code == 201

    missing = client.post("/api/public/comments", json={"post_slug": "a-post", "content": "No name"}, headers=headers)
    assert missing.status_code == 422
    bad_email = client.post("/api/public/comments", json={
        "post_slug": "a-post", "author_name": "X", "author_email": "not-an-email", "content": "Hi",
    }, headers=headers)
    assert bad_email.status_code == 422
    other_site = client.post("/api/public/comments", json={
        "post_slug": "a-post", "author_name": "X", "author_email": "x@example.com", "content": "Hi",
    }, headers=visitor("192.0.2.31") | {"Origin": "https://other-site.example.com"})
    assert other_site.status_code == 403
    assert client.get("/api/public/auth/me").json()["sign_in"] is False


def test_once_sign_in_is_on_a_name_and_email_are_not_enough(client):
    r = client.post("/api/public/comments", json={
        "post_slug": "a-post", "author_name": "Anon", "author_email": "a@example.com", "content": "Hi",
    }, headers=visitor("192.0.2.32") | {"Origin": BLOG})
    assert r.status_code == 401
