import pytest
from playwright.sync_api import APIRequestContext


@pytest.mark.parametrize(
    "payload, expected_status, expected_fields",
    [
        pytest.param({}, 400, ["name", "email"], id="empty body"),
        pytest.param({"name": "No Email"}, 400, ["email"], id="email missing"),
        pytest.param({"name": "", "email": "a@example.com"}, 422, ["name"], id="name empty"),
        pytest.param({"name": "x" * 101, "email": "a@example.com"}, 422, ["name"], id="name too long"),
        pytest.param({"name": "Bad Email", "email": "not-an-email"}, 422, ["email"], id="email invalid"),
        pytest.param({"name": "Bad Role", "email": "a@example.com", "role": "owner"}, 422, ["role"], id="role unknown"),
    ],
)
def test_create_user_rejects_bad_input(api_context: APIRequestContext, payload, expected_status, expected_fields):
    users_before = len(api_context.get("/users").json())

    response = api_context.post("/users", data=payload)

    assert response.status == expected_status
    assert response.json()["fields"] == expected_fields  # the error says which fields are wrong
    assert len(api_context.get("/users").json()) == users_before  # and nothing was created


def test_create_user_rejects_a_duplicate_email(api_context: APIRequestContext, created_user: dict):
    response = api_context.post("/users", data={"name": "Twin", "email": created_user["email"]})

    assert response.status == 409
    assert response.json() == {"error": "email_taken"}
