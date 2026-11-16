"""Subscribing: the visitor is told the truth about the confirmation email,
and the rate limit applies per visitor, not to everyone behind the proxy."""
import asyncio

import pytest

from app.api.v1 import subscribers
from app.config import settings
from app.core.email import send_confirmation_email, send_newsletter
from app.database import SessionLocal
from app.models.subscriber import Subscriber

SUBSCRIBE = "/api/v1/subscribers/subscribe"
SENT_TEXT = "check your inbox"
FAILED_TEXT = "couldn't send the confirmation email"


@pytest.fixture
def mailer(monkeypatch):
    """Replaces the confirmation sender; set .result to what it returns."""
    class Mailer:
        result = True
        calls: list[str] = []

        async def __call__(self, email, name, token):
            self.calls.append(email)
            if isinstance(self.result, Exception):
                raise self.result
            return self.result

    m = Mailer()
    m.calls = []
    monkeypatch.setattr(subscribers, "send_confirmation_email", m)
    return m


def stored(email):
    db = SessionLocal()
    try:
        return db.query(Subscriber).filter(Subscriber.email == email).first()
    finally:
        db.close()


def test_a_sent_link_says_check_your_inbox(client, mailer):
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202
    assert SENT_TEXT in res.json()["detail"]
    assert mailer.calls == ["reader@example.com"]
    sub = stored("reader@example.com")
    assert not sub.is_active and sub.confirmation_token


@pytest.mark.parametrize("outcome", [False, RuntimeError("Resend said no")])
def test_a_failed_send_is_reported_and_can_be_retried(client, mailer, outcome):
    mailer.result = outcome
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 503
    assert FAILED_TEXT in res.json()["detail"]
    assert stored("reader@example.com").is_active is False

    mailer.result = True
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202


def test_an_already_confirmed_address_gets_the_same_answer_and_no_email(client, mailer):
    db = SessionLocal()
    db.add(Subscriber(email="reader@example.com", is_active=True))
    db.commit()
    db.close()
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 202 and SENT_TEXT in res.json()["detail"]
    assert mailer.calls == []


def test_the_rate_limit_is_per_visitor(client, mailer):
    a, b = {"X-Forwarded-For": "203.0.113.1"}, {"X-Forwarded-For": "203.0.113.2"}
    for i in range(3):
        assert client.post(SUBSCRIBE, json={"email": f"a{i}@example.com"}, headers=a).status_code == 202
    assert client.post(SUBSCRIBE, json={"email": "a9@example.com"}, headers=a).status_code == 429
    assert client.post(SUBSCRIBE, json={"email": "b@example.com"}, headers=b).status_code == 202


# ── Without a Resend key ─────────────────────────────────────────────────────

def test_without_a_key_production_reports_the_failure(client, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "DEBUG", False)
    res = client.post(SUBSCRIBE, json={"email": "reader@example.com"})
    assert res.status_code == 503
    assert FAILED_TEXT in res.json()["detail"]
    assert client.get("/health").json()["email"] == "off"


def test_without_a_key_local_development_logs_the_link(monkeypatch, caplog):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "DEBUG", True)
    with caplog.at_level("INFO"):
        assert asyncio.run(send_confirmation_email("reader@example.com", "", "tok")) is True
    assert "subscribers/confirm?token=tok" in caplog.text


def test_without_a_key_a_newsletter_is_reported_as_not_sent(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    recipients = [{"email": f"r{i}@example.com", "name": "", "unsubscribe_token": "t"} for i in range(2)]
    result = asyncio.run(send_newsletter(recipients, "Subject", "<p>Body</p>"))
    assert result["sent"] == 0 and result["failed"] == 2
    assert "RESEND_API_KEY" in result["errors"][0]


def test_health_says_when_email_is_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    assert client.get("/health").json()["email"] == "on"
