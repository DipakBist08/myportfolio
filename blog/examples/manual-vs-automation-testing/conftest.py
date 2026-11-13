from typing import Iterator

import pytest

import app


@pytest.fixture(scope="session")
def base_url() -> Iterator[str]:
    """Start the local login app once per test run.

    pytest-playwright passes this value to every browser context as its base
    URL, so tests can call page.goto("/login").
    """
    server, url = app.start()
    yield url
    server.shutdown()
