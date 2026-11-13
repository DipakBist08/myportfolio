"""pytest + Playwright fixtures for the portfolio.

`pytest` starts a static server for the repository root on a free port,
then runs every test in a desktop and a mobile browser context. Set
BASE_URL to test a deployed copy instead.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, Playwright

ROOT = Path(__file__).resolve().parent.parent


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def base_url() -> str:
    """Overrides pytest-base-url's fixture: serve the site unless BASE_URL is set."""
    if os.environ.get("BASE_URL"):
        yield os.environ["BASE_URL"].rstrip("/") + "/"
        return
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}/"
    for _ in range(50):
        try:
            urlopen(url, timeout=1).read(1)
            break
        except OSError:
            time.sleep(0.1)
    try:
        yield url
    finally:
        proc.terminate()
        proc.wait(timeout=5)


@pytest.fixture(params=["desktop", "mobile"])
def device(request) -> str:
    return request.param


@pytest.fixture
def ctx(browser: Browser, playwright: Playwright, device: str, base_url: str) -> BrowserContext:
    if device == "mobile":
        options = dict(playwright.devices["Pixel 7"])
    else:
        options = {"viewport": {"width": 1440, "height": 900}}
    context = browser.new_context(base_url=base_url, **options)
    yield context
    context.close()


@pytest.fixture
def pg(ctx: BrowserContext) -> Page:
    page = ctx.new_page()
    yield page
    page.close()


@pytest.fixture
def is_mobile(device: str) -> bool:
    return device == "mobile"
