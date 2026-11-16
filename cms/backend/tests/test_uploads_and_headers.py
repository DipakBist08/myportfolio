"""Uploads are checked by content and served inert; API responses carry
security headers; settings refuse placeholder secrets and default logins."""
import io

import pytest
from PIL import Image
from pydantic import ValidationError

from app.config import Settings

UPLOAD = "/api/v1/media/upload"


def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (3, 2), "teal").save(buf, format="PNG")
    return buf.getvalue()


def upload(client, headers, name, data, content_type):
    return client.post(UPLOAD, headers=headers, files={"file": (name, data, content_type)})


def test_svg_is_refused(client, admin_headers):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    res = upload(client, admin_headers, "logo.svg", svg, "image/svg+xml")
    assert res.status_code == 415
    assert "SVG" in res.json()["detail"]


@pytest.mark.parametrize("name, data, claimed", [
    ("photo.png", b"<html><script>alert(1)</script></html>", "image/png"),   # markup labelled as an image
    ("photo.png", b"%PDF-1.7 not an image", "image/png"),
    ("doc.pdf", png_bytes(), "application/pdf"),
    ("notes.txt", b"\x00\x01binary", "text/plain"),
    ("photo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 20, "image/png"),         # right signature, broken image
])
def test_content_must_match_the_claimed_type(client, admin_headers, name, data, claimed):
    assert upload(client, admin_headers, name, data, claimed).status_code == 415


def test_html_is_refused(client, admin_headers):
    assert upload(client, admin_headers, "page.html", b"<h1>x</h1>", "text/html").status_code == 415


def test_stored_name_comes_from_the_content_not_the_file_name(client, admin_headers):
    res = upload(client, admin_headers, "evil.html", png_bytes(), "image/png")
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["filename"].endswith(".png") and body["url"].endswith(".png")
    assert body["mime_type"] == "image/png"
    assert (body["width"], body["height"]) == (3, 2)


def test_text_with_markup_is_served_as_inert_plain_text(client, admin_headers):
    res = upload(client, admin_headers, "x.html", b"<script>alert(1)</script>", "text/plain")
    assert res.status_code == 201, res.text
    url = res.json()["url"]
    assert url.endswith(".txt")
    served = client.get(url[url.index("/uploads/"):])
    assert served.headers["content-type"].startswith("text/plain")
    assert served.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in served.headers["content-security-policy"]
    assert "default-src 'none'" in served.headers["content-security-policy"]


def test_windows_zip_type_is_accepted(client, admin_headers):
    res = upload(client, admin_headers, "a.zip", b"PK\x05\x06" + b"\x00" * 18, "application/x-zip-compressed")
    assert res.status_code == 201, res.text
    assert res.json()["mime_type"] == "application/zip"


def test_empty_and_oversized_files_are_refused(client, admin_headers, monkeypatch):
    assert upload(client, admin_headers, "a.txt", b"", "text/plain").status_code == 400
    from app.config import settings
    monkeypatch.setattr(settings, "MAX_FILE_SIZE", 10)
    assert upload(client, admin_headers, "a.txt", b"x" * 11, "text/plain").status_code == 413


def test_api_responses_carry_security_headers(client, admin_headers):
    for res in (client.get("/health"), client.get("/api/v1/auth/me", headers=admin_headers)):
        h = res.headers
        assert h["x-content-type-options"] == "nosniff"
        assert h["x-frame-options"] == "DENY"
        assert "frame-ancestors 'none'" in h["content-security-policy"]
        assert h["strict-transport-security"].startswith("max-age=")
    assert client.get("/api/v1/auth/me", headers=admin_headers).headers["cache-control"] == "no-store"


# ── Settings ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("key", [
    "change-this-to-a-64-char-random-hex-string-in-production",
    "REPLACE_WITH_A_RANDOM_64_CHARACTER_HEX_STRING_0000000000",
    "your-secret-key-goes-here-0123456789abcdef",
    "too-short",
])
def test_placeholder_secret_keys_are_refused(key):
    with pytest.raises(ValidationError):
        Settings(SECRET_KEY=key, _env_file=None)


def test_no_default_admin_login_and_debug_off_by_default(monkeypatch):
    for name in ("ADMIN_EMAIL", "ADMIN_PASSWORD", "DEBUG"):
        monkeypatch.delenv(name, raising=False)
    s = Settings(SECRET_KEY="0123456789abcdef" * 4, _env_file=None)
    assert s.ADMIN_EMAIL is None and s.ADMIN_PASSWORD is None
    assert s.DEBUG is False
