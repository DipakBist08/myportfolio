"""A small in-memory "users" REST API for the examples.

Standard library only, so the tests need nothing but Playwright and pytest.
It exists so every example in the article can be run by anyone, with no
account and no network access. It is test scaffolding, not a production server.

Contract
--------
Authentication: `Authorization: Bearer <token>`.
    admin-token   role "admin"   can read and write
    viewer-token  role "viewer"  can only read

    GET    /health            200, no authentication
    GET    /users             200, list of users
    GET    /users/{id}        200, or 404
    POST   /users             201 (admin). 400 missing field, 422 invalid value, 409 duplicate email
    PATCH  /users/{id}        200 (admin). 422 invalid value, 404
    DELETE /users/{id}        204 (admin), or 404
    GET    /admin/settings    200 (admin)

    Any protected route: 401 without a valid token, 403 with the wrong role.
"""

from __future__ import annotations

import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKENS = {"admin-token": "admin", "viewer-token": "viewer"}
ROLES = {"admin", "editor", "viewer"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_NAME_LENGTH = 100


class Store:
    """All state lives here, so a test run starts from a known point."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.users = {1: {"id": 1, "name": "Asha Rai", "email": "asha@example.com", "role": "admin"}}
        self.next_id = 2


def invalid_fields(payload: dict, partial: bool = False) -> tuple[list[str], list[str]]:
    """Return (missing, invalid) field names for a create or update payload."""
    missing = [] if partial else [f for f in ("name", "email") if f not in payload]
    invalid = []
    if "name" in payload:
        name = payload["name"]
        if not isinstance(name, str) or not name.strip() or len(name) > MAX_NAME_LENGTH:
            invalid.append("name")
    if "email" in payload:
        email = payload["email"]
        if not isinstance(email, str) or not EMAIL_RE.match(email):
            invalid.append("email")
    if "role" in payload and payload["role"] not in ROLES:
        invalid.append("role")
    return missing, invalid


def make_handler(store: Store):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args) -> None:  # keep pytest output clean
            pass

        # ---- helpers -------------------------------------------------
        def send_json(self, status: int, body=None) -> None:
            data = b"" if body is None else json.dumps(body).encode()
            self.send_response(status)
            if body is not None:
                self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def read_json(self):
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            try:
                return json.loads(raw or b"null")
            except json.JSONDecodeError:
                return None

        def role(self) -> str | None:
            header = self.headers.get("Authorization", "")
            return TOKENS.get(header.removeprefix("Bearer ").strip()) if header.startswith("Bearer ") else None

        def authorize(self, needs_admin: bool) -> bool:
            """Send 401 or 403 and return False when the caller may not proceed."""
            role = self.role()
            if role is None:
                self.send_json(401, {"error": "unauthorized"})
                return False
            if needs_admin and role != "admin":
                self.send_json(403, {"error": "forbidden"})
                return False
            return True

        def user_id(self) -> int | None:
            match = re.fullmatch(r"/users/(\d+)", self.path)
            return int(match.group(1)) if match else None

        # ---- routes --------------------------------------------------
        def do_GET(self) -> None:
            if self.path == "/health":
                return self.send_json(200, {"status": "ok"})
            if self.path == "/admin/settings":
                if self.authorize(needs_admin=True):
                    self.send_json(200, {"signup_enabled": True})
                return
            if not self.authorize(needs_admin=False):
                return
            if self.path == "/users":
                with store.lock:
                    return self.send_json(200, list(store.users.values()))
            user_id = self.user_id()
            with store.lock:
                user = store.users.get(user_id) if user_id is not None else None
            if user is None:
                return self.send_json(404, {"error": "not_found"})
            self.send_json(200, user)

        def do_POST(self) -> None:
            payload = self.read_json()  # always drain the body before answering
            if self.path != "/users":
                return self.send_json(404, {"error": "not_found"})
            if not self.authorize(needs_admin=True):
                return
            if not isinstance(payload, dict):
                return self.send_json(400, {"error": "invalid_json"})
            missing, invalid = invalid_fields(payload)
            if missing:
                return self.send_json(400, {"error": "missing_fields", "fields": missing})
            if invalid:
                return self.send_json(422, {"error": "invalid_fields", "fields": invalid})
            with store.lock:
                if any(u["email"] == payload["email"] for u in store.users.values()):
                    return self.send_json(409, {"error": "email_taken"})
                user = {
                    "id": store.next_id,
                    "name": payload["name"],
                    "email": payload["email"],
                    "role": payload.get("role", "viewer"),
                }
                store.users[user["id"]] = user
                store.next_id += 1
            self.send_json(201, user)

        def do_PATCH(self) -> None:
            payload = self.read_json()
            user_id = self.user_id()
            if user_id is None:
                return self.send_json(404, {"error": "not_found"})
            if not self.authorize(needs_admin=True):
                return
            if not isinstance(payload, dict):
                return self.send_json(400, {"error": "invalid_json"})
            _, invalid = invalid_fields(payload, partial=True)
            if invalid:
                return self.send_json(422, {"error": "invalid_fields", "fields": invalid})
            with store.lock:
                user = store.users.get(user_id)
                if user is None:
                    return self.send_json(404, {"error": "not_found"})
                user.update({k: v for k, v in payload.items() if k in ("name", "email", "role")})
                updated = dict(user)
            self.send_json(200, updated)

        def do_DELETE(self) -> None:
            user_id = self.user_id()
            if user_id is None:
                return self.send_json(404, {"error": "not_found"})
            if not self.authorize(needs_admin=True):
                return
            with store.lock:
                existed = store.users.pop(user_id, None) is not None
            self.send_json(204 if existed else 404, None if existed else {"error": "not_found"})

    return Handler


def start(port: int = 0) -> tuple[ThreadingHTTPServer, str]:
    """Start the API on a free local port. Returns (server, base_url)."""
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(Store()))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


if __name__ == "__main__":
    api, url = start(8000)
    print(f"Mock users API on {url} (Ctrl+C to stop)")
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        api.shutdown()
