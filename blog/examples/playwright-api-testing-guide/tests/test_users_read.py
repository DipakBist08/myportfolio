from playwright.sync_api import APIRequestContext, expect


def test_get_user_returns_the_user(api_context: APIRequestContext):
    response = api_context.get("/users/1")

    expect(response).to_be_ok()  # any 2xx status

    body = response.json()
    assert body["id"] == 1
    assert body["email"] == "asha@example.com"
    assert response.headers["content-type"] == "application/json"


def test_get_missing_user_returns_404(api_context: APIRequestContext):
    response = api_context.get("/users/999999")

    assert response.status == 404
    assert response.json() == {"error": "not_found"}


def test_list_users_includes_a_created_user(api_context: APIRequestContext, created_user: dict):
    response = api_context.get("/users")

    expect(response).to_be_ok()
    assert created_user["id"] in [user["id"] for user in response.json()]
