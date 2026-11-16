"""Brute-force protection for sign-in, authenticator codes and password checks.

Failures are counted per key (an account, an IP address, a user id) in a
sliding window. Once a key reaches its limit, further attempts are refused
with 429 until the oldest counted failure leaves the window: a blocked
attempt never reaches the password or code check, so it reveals nothing.

Counters live in memory. The API runs as a single process (see Dockerfile),
so one set of counters covers every request; a restart clears them.
"""
from __future__ import annotations

import math
import threading
import time
from collections import deque

from fastapi import HTTPException, status

# Sweep expired keys once this many are held, so a flood of distinct keys
# (random emails, rotating IPs) cannot grow memory without bound.
_SWEEP_AT = 10_000


class FailureLimiter:
    def __init__(self, limit: int, window_seconds: float, message: str):
        self.limit = limit
        self.window = window_seconds
        self.message = message
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _live(self, key: str, now: float) -> deque[float] | None:
        times = self._failures.get(key)
        if times is None:
            return None
        while times and times[0] <= now - self.window:
            times.popleft()
        if not times:
            del self._failures[key]
            return None
        return times

    def retry_after(self, key: str) -> int:
        """Seconds until `key` may try again; 0 when it is not blocked."""
        with self._lock:
            now = time.monotonic()
            times = self._live(key, now)
            if times is None or len(times) < self.limit:
                return 0
            return max(1, math.ceil(times[-self.limit] + self.window - now))

    def check(self, *keys: str) -> None:
        """Raise 429 if any of `keys` has used up its failures."""
        wait = max((self.retry_after(k) for k in keys), default=0)
        if wait:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=self.message,
                headers={"Retry-After": str(wait)},
            )

    def fail(self, *keys: str) -> None:
        with self._lock:
            now = time.monotonic()
            if len(self._failures) >= _SWEEP_AT:
                for key in list(self._failures):
                    self._live(key, now)
            for key in keys:
                times = self._live(key, now)
                if times is None:
                    times = self._failures[key] = deque()
                times.append(now)
                # Only the newest `limit` failures decide a block.
                while len(times) > self.limit:
                    times.popleft()

    def reset(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._failures.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


class OneTimeTokens:
    """Remembers token ids (JWT `jti`) that have been used, until they expire."""

    def __init__(self) -> None:
        self._used: dict[str, float] = {}
        self._lock = threading.Lock()

    def claim(self, token_id: str, expires_at: float) -> bool:
        """Mark `token_id` used. False if it was already used."""
        with self._lock:
            now = time.time()
            for tid, exp in list(self._used.items()):
                if exp <= now:
                    del self._used[tid]
            if token_id in self._used:
                return False
            self._used[token_id] = expires_at
            return True

    def clear(self) -> None:
        with self._lock:
            self._used.clear()


# Wrong passwords, per account and per IP address: sign-in, password change
# and the password check before MFA setup all count here.
PASSWORD_FAILURES = FailureLimiter(
    limit=10, window_seconds=15 * 60,
    message="Too many failed attempts. Try again in a few minutes.",
)

# Wrong authenticator codes, per user, across every endpoint that takes one.
# Five per 15 minutes keeps guessing a 6-digit code impractical.
MFA_FAILURES = FailureLimiter(
    limit=5, window_seconds=15 * 60,
    message="Too many incorrect codes. Try again in a few minutes.",
)

# MFA sign-in tokens, each usable for one successful sign-in.
USED_MFA_TOKENS = OneTimeTokens()


def account_key(email: str) -> str:
    return f"account:{email.strip().lower()}"


def ip_key(ip: str) -> str:
    return f"ip:{ip}"


def user_key(user_id: int) -> str:
    return f"user:{user_id}"
