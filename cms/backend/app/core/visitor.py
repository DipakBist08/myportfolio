"""Anonymous visitor identity, used to count visits and readers and to keep
comment reactions to one per person.

No IP address is stored and nothing is written to the visitor's browser. A
visitor is a keyed hash (HMAC-SHA256 with the app's SECRET_KEY) of the
client's IP address and user agent: the same browser on the same connection
counts once, and the value cannot be reversed or matched across sites.
"""
from __future__ import annotations

import hashlib
import hmac
import re

from fastapi import Request

from app.config import settings

# Crawlers, link-preview fetchers, monitors and scripted clients: not visitors.
_NOT_A_VISITOR = re.compile(
    r"bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|"
    r"whatsapp|telegram|discord|embedly|monitor|uptime|curl|wget|python-|httpx|axios|"
    r"node-fetch|go-http|okhttp|java/",
    re.IGNORECASE,
)


def client_ip(request: Request) -> str:
    """The visitor's address. Behind the hosting proxy the socket peer is the
    proxy itself, which appends the real client address as the last
    X-Forwarded-For entry (earlier entries are whatever the client sent)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        last = forwarded.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else "unknown"


def visitor_hash(request: Request) -> str:
    agent = request.headers.get("user-agent", "")[:500]
    message = f"{client_ip(request)}|{agent}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()[:32]


def is_bot(request: Request) -> bool:
    agent = request.headers.get("user-agent", "")
    return not agent or bool(_NOT_A_VISITOR.search(agent))
