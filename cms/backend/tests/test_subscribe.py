"""Subscribing is single opt-in: the address is on the list as soon as the
visitor clicks Subscribe, and a welcome email carries a one-click unsubscribe
link. The rate limit applies per visitor, not to everyone behind the proxy."""
import asyncio
import secrets

import pytest
import resend

from app.api.v1 import subscribers
from app.config import settings
from app.core.email import send_newsletter, send_welcome_email
from app.database import SessionLocal
from app.models.subscriber import Subscriber

SUBSCRIBE = "/api/v1/subscribers/subscribe"
SUBSCRIBED_TEXT = "You're subscribed"


@pytest.fixture
def mailer(monkeypatch):
    """Replaces the welcome sender; set .result to what it returns."""
    class Mailer:
        result = True
        calls: list[tuple[str, str]] = []

        async def __call__(self, email, name, unsubscribe_token):
            self.calls.append((email, unsubscribe_token))
            if isinstance(self.result, Exception):
                raise self.result
            return self.result

    m = Mailer()
    m.calls = []
    monkeypatch.setattr(subscribers, "send_welcome_email", m)
    return m


def stored(email):
    db = SessionLocal()
    try:
        return db.query(Subscriber).filter(Subscriber.email == email).first()
    finally:
        db.close()


def add(**fields):
    db = SessionLocal()
    db.add(Subscriber(unsubscribe_token=secrets.token_urlsafe(16), **fields))
    db.commit()
    db.close()


def test_subscribing_puts_the_address_on_the_list_at_once(client, mailer):
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202
    assert SUBSCRIBED_TEXT in res.json()["detail"]
    sub = stored("reader@example.com")
    assert sub.is_active and not sub.is_unsubscribed
    assert sub.confirmed_at is not None and sub.confirmation_token is None
    # The welcome email gets the subscriber's own unsubscribe link.
    assert mailer.calls == [("reader@example.com", sub.unsubscribe_token)]


@pytest.mark.parametrize("outcome", [False, RuntimeError("Resend said no")])
def test_a_failed_welcome_email_does_not_undo_the_subscription(client, mailer, outcome):
    mailer.result = outcome
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202 and SUBSCRIBED_TEXT in res.json()["detail"]
    assert stored("reader@example.com").is_active is True


def test_an_address_already_on_the_list_gets_the_same_answer_and_no_email(client, mailer):
    add(email="reader@example.com", is_active=True)
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202 and SUBSCRIBED_TEXT in res.json()["detail"]
    assert mailer.calls == []


def test_an_address_left_pending_by_the_old_confirmation_step_is_activated(client, mailer):
    add(email="reader@example.com", is_active=False, confirmation_token="old-link")
    assert client.post(SUBSCRIBE, json={"email": "reader@example.com"}).status_code == 202
    sub = stored("reader@example.com")
    assert sub.is_active and sub.confirmation_token is None
    assert [c[0] for c in mailer.calls] == ["reader@example.com"]


def test_someone_who_unsubscribed_can_subscribe_again(client, mailer):
    add(email="reader@example.com", is_active=False, is_unsubscribed=True)
    assert client.post(SUBSCRIBE, json={"email": "reader@example.com"}).status_code == 202
    sub = stored("reader@example.com")
    assert sub.is_active and not sub.is_unsubscribed and sub.unsubscribed_at is None


def test_the_unsubscribe_link_takes_a_new_subscriber_off_the_list(client, mailer):
    client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    token = mailer.calls[0][1]
    res = client.get(f"/api/v1/subscribers/unsubscribe?token={token}")
    assert res.status_code == 200 and "Unsubscribed" in res.text
    sub = stored("reader@example.com")
    assert sub.is_unsubscribed and not sub.is_active


def test_confirmation_links_sent_before_the_change_still_work(client):
    add(email="reader@example.com", is_active=False, confirmation_token="sent-earlier")
    res = client.get("/api/v1/subscribers/confirm?token=sent-earlier")
    assert res.status_code == 200 and "You're subscribed" in res.text
    assert stored("reader@example.com").is_active is True


def test_the_rate_limit_is_per_visitor(client, mailer):
    a, b = {"X-Forwarded-For": "203.0.113.1"}, {"X-Forwarded-For": "203.0.113.2"}
    for i in range(3):
        assert client.post(SUBSCRIBE, json={"email": f"a{i}@example.com"}, headers=a).status_code == 202
    assert client.post(SUBSCRIBE, json={"email": "a9@example.com"}, headers=a).status_code == 429
    assert client.post(SUBSCRIBE, json={"email": "b@example.com"}, headers=b).status_code == 202


# ── The welcome email itself ─────────────────────────────────────────────────

def test_the_welcome_email_links_to_unsubscribe_and_escapes_the_name(monkeypatch):
    sent = []
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(settings, "BACKEND_URL", "https://api.example.com")
    monkeypatch.setattr(resend.Emails, "send", lambda params: sent.append(params))
    assert asyncio.run(send_welcome_email("reader@example.com", "<b>Ann</b>", "tok123")) is True
    html = sent[0]["html"]
    assert sent[0]["to"] == ["reader@example.com"]
    assert "https://api.example.com/api/v1/subscribers/unsubscribe?token=tok123" in html
    assert "&lt;b&gt;Ann&lt;/b&gt;" in html and "<b>Ann</b>" not in html


# ── Without a Resend key ─────────────────────────────────────────────────────

def test_without_a_key_production_still_subscribes_but_sends_nothing(client, monkeypatch, caplog):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "DEBUG", False)
    with caplog.at_level("WARNING"):
        res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202
    assert stored("reader@example.com").is_active is True
    assert "RESEND_API_KEY is not set" in caplog.text
    assert client.get("/health").json()["email"] == "off"


def test_without_a_key_local_development_logs_the_welcome(monkeypatch, caplog):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "DEBUG", True)
    with caplog.at_level("INFO"):
        assert asyncio.run(send_welcome_email("reader@example.com", "", "tok")) is True
    assert "subscribers/unsubscribe?token=tok" in caplog.text


def test_without_a_key_a_newsletter_is_reported_as_not_sent(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    recipients = [{"email": f"r{i}@example.com", "name": "", "unsubscribe_token": "t"} for i in range(2)]
    result = asyncio.run(send_newsletter(recipients, "Subject", "<p>Body</p>"))
    assert result["sent"] == 0 and result["failed"] == 2
    assert "RESEND_API_KEY" in result["errors"][0]


def test_health_says_when_email_is_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    assert client.get("/health").json()["email"] == "on"
