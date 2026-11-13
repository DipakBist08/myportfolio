import os
import uuid
from typing import Iterator

import pytest
from playwright.sync_api import APIRequestContext, Playwright

import mock_api


@pytest.fixture(scope="session")
def base_url() -> Iterator[str]:
    """Use API_BASE_URL when it is set; otherwise start the local mock API."""
    external = os.environ.get("API_BASE_URL")
    if external:  # an empty value (an unset CI variable) falls through to the mock
        yield external
        return
    server, url = mock_api.start()
    yield url
    server.shutdown()


def new_context(playwright: Playwright, base_url: str, token: str | None) -> APIRequestContext:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return playwright.request.new_context(base_url=base_url, extra_http_headers=headers)


def token(name: str, mock_default: str) -> str:
    # `or`, not a get() default: CI sets the variable to "" when a secret is missing.
    return os.environ.get(name) or mock_default


@pytest.fixture(scope="session")
def api_context(playwright: Playwright, base_url: str) -> Iterator[APIRequestContext]:
    """Requests sent as an admin. The token comes from the environment, never from the code."""
    context = new_context(playwright, base_url, token("API_TOKEN", "admin-token"))
    yield context
    context.dispose()


@pytest.fixture(scope="session")
def viewer_context(playwright: Playwright, base_url: str) -> Iterator[APIRequestContext]:
    """Requests sent as a read-only user."""
    context = new_context(playwright, base_url, token("API_VIEWER_TOKEN", "viewer-token"))
    yield context
    context.dispose()


@pytest.fixture(scope="session")
def anonymous_context(playwright: Playwright, base_url: str) -> Iterator[APIRequestContext]:
    """Requests sent with no token at all."""
    context = new_context(playwright, base_url, token=None)
    yield context
    context.dispose()


@pytest.fixture
def unique_email() -> str:
    """A fresh address per test, so tests never collide on the unique-email rule."""
    return f"qa-{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture
def created_user(api_context: APIRequestContext, unique_email: str) -> Iterator[dict]:
    """Create a user for one test and delete it afterwards, even if the test fails."""
    response = api_context.post("/users", data={"name": "QA Tester", "email": unique_email, "role": "viewer"})
    assert response.status == 201, response.text()
    user = response.json()
    yield user
    api_context.delete(f"/users/{user['id']}")  # 404 is fine if the test already deleted it
