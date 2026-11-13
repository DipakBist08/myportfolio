"""A tiny login app for the example test: /login and /dashboard.

Standard library only, so the example runs anywhere with no account and no
network. It is test scaffolding, not a real authentication system.

    GET  /login       sign-in form
    POST /login       303 to /dashboard on success; 401 and an error message otherwise
    GET  /dashboard   the signed-in page; 303 to /login without a valid session
"""

from __future__ import annotations

import html
import secrets
import threading
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

USERS = {"qa.user@example.com": ("correct-horse-battery", "QA User")}

LOGIN_PAGE = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Sign in</title></head>
<body>
  <main>
    <h1>Sign in</h1>
    {error}
    <form method="post" action="/login">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
  </main>
</body>
</html>"""

DASHBOARD_PAGE = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Dashboard</title></head>
<body><main><h1>Welcome, {name}</h1></main></body>
</html>"""

LOGIN_ERROR = '<p role="alert">Email or password is incorrect.</p>'


def make_handler(sessions: dict[str, str]):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args) -> None:  # keep pytest output clean
            pass

        def send_page(self, status: int, body: str, headers: dict[str, str] | None = None) -> None:
            data = body.encode()
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(data)

        def redirect(self, location: str, headers: dict[str, str] | None = None) -> None:
            self.send_page(303, "", {"Location": location, **(headers or {})})

        def session_user(self) -> str | None:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            token = cookie["session"].value if "session" in cookie else None
            return sessions.get(token) if token else None

        def do_GET(self) -> None:
            if self.path == "/login":
                return self.send_page(200, LOGIN_PAGE.format(error=""))
            if self.path == "/dashboard":
                name = self.session_user()
                if name is None:
                    return self.redirect("/login")
                return self.send_page(200, DASHBOARD_PAGE.format(name=html.escape(name)))
            self.send_page(404, "Not found")

        def do_POST(self) -> None:
            length = int(self.headers.get("Content-Length") or 0)
            form = parse_qs(self.rfile.read(length).decode())
            if self.path != "/login":
                return self.send_page(404, "Not found")

            email = form.get("email", [""])[0]
            password = form.get("password", [""])[0]
            user = USERS.get(email)
            if user is None or not secrets.compare_digest(user[0], password):
                return self.send_page(401, LOGIN_PAGE.format(error=LOGIN_ERROR))

            token = secrets.token_urlsafe(16)
            sessions[token] = user[1]
            self.redirect("/dashboard", {"Set-Cookie": f"session={token}; HttpOnly; SameSite=Lax; Path=/"})

    return Handler


def start(port: int = 0) -> tuple[ThreadingHTTPServer, str]:
    """Start the app on a free local port. Returns (server, base_url)."""
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler({}))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


if __name__ == "__main__":
    app, url = start(8001)
    print(f"Login app on {url}/login (Ctrl+C to stop)")
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        app.shutdown()
