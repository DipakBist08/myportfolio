"""Test setup: a throwaway SQLite database and a test secret, set before the
app (and its settings) are imported. Run from cms/backend:

    pip install -r requirements.txt
    pytest
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

_DB = Path(tempfile.mkdtemp(prefix="cms-tests-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
os.environ["SECRET_KEY"] = "test-secret-" + "0123456789abcdef" * 4
os.environ["DEBUG"] = "false"
os.environ["UPLOAD_DIR"] = str(_DB.parent / "uploads")
os.environ["GOOGLE_CLIENT_ID"] = "test-client.apps.googleusercontent.com"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import create_access_token, hash_password  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402

BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36"


@pytest.fixture
def client():
    """A fresh, empty database and fresh rate limits for every test."""
    from app.api.public import comments
    from app.core import throttle
    from app.core.security import forget_accepted_codes

    from app.api.v1 import subscribers

    comments._comment_attempts.clear()
    comments._reaction_attempts.clear()
    subscribers._subscribe_attempts.clear()
    from app.api.public import engagement, readers

    readers._signin_attempts.clear()
    engagement._clap_attempts.clear()
    throttle.PASSWORD_FAILURES.clear()
    throttle.MFA_FAILURES.clear()
    throttle.USED_MFA_TOKENS.clear()
    throttle.RESET_REQUESTS_PER_ACCOUNT.clear()
    throttle.RESET_REQUESTS_PER_IP.clear()
    throttle.USED_RESET_TOKENS.clear()
    forget_accepted_codes()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_headers(client):
    db = SessionLocal()
    try:
        user = User(email="admin@example.com", username="admin", hashed_password=hash_password("x" * 12))
        db.add(user)
        db.commit()
        token = create_access_token({"sub": str(user.id)})
    finally:
        db.close()
    return {"Authorization": f"Bearer {token}"}


def visitor(ip: str, agent: str = BROWSER) -> dict:
    """Request headers for a distinct visitor (the proxy's X-Forwarded-For)."""
    return {"User-Agent": agent, "X-Forwarded-For": ip}


# ----- blog readers (Google sign-in) ---------------------------------------------

BLOG = "https://blog.dipakbist.com.np"
GOOGLE_CLIENT = os.environ["GOOGLE_CLIENT_ID"]


class FakeGoogle:
    """Stands in for Google: signs ID tokens with its own RSA key and serves
    the public half where app.core.readers looks for Google's keys, so the
    API's real checks (signature, audience, issuer, expiry, verified email) run."""

    def __init__(self):
        import time as _time

        import jwt as _jwt
        from cryptography.hazmat.primitives.asymmetric import rsa

        self._jwt, self._time = _jwt, _time
        self.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.kid = "fake-google-key"

    def token(self, sub="1001", name="Asha Reader", email="asha@example.com", key=None, **overrides) -> str:
        now = int(self._time.time())
        claims = {
            "iss": "https://accounts.google.com", "aud": GOOGLE_CLIENT, "sub": sub,
            "email": email, "email_verified": True, "name": name,
            "picture": f"https://lh3.googleusercontent.com/a/{sub}=s96-c",
            "iat": now, "exp": now + 3600,
        } | overrides
        claims = {k: v for k, v in claims.items() if v is not None}
        return self._jwt.encode(claims, key or self.private_key, algorithm="RS256", headers={"kid": self.kid})

    # The one method of jwt.PyJWKClient the API calls.
    def get_signing_key_from_jwt(self, token):
        header = self._jwt.get_unverified_header(token)
        if header.get("kid") != self.kid:
            raise self._jwt.PyJWKClientError("Unable to find a signing key that matches")
        return type("Key", (), {"key": self.private_key.public_key()})()


@pytest.fixture
def google(client, monkeypatch):
    from app.core import readers

    fake = FakeGoogle()
    monkeypatch.setattr(readers, "_google_keys", lambda: fake)
    return fake


def sign_in(client, google, ip="192.0.2.10", **claims) -> dict:
    """Sign a reader in and return request headers that carry their session
    (the cookie is Secure, which the http:// test client would not send back)."""
    r = client.post("/api/public/auth/google", json={"credential": google.token(**claims)},
                    headers=visitor(ip) | {"Origin": BLOG})
    assert r.status_code == 200, r.text
    session = session_cookie(r)["value"]
    client.cookies.clear()
    return visitor(ip) | {"Origin": BLOG, "Cookie": f"reader_session={session}"}


def session_cookie(response) -> dict:
    """The reader_session Set-Cookie of a response: its value and attributes."""
    from http.cookies import SimpleCookie

    for header in response.headers.get_list("set-cookie"):
        jar = SimpleCookie()
        jar.load(header)
        if "reader_session" in jar:
            morsel = jar["reader_session"]
            return {"value": morsel.value, **{k: v for k, v in morsel.items() if v}}
    raise AssertionError("no reader_session cookie in the response")
