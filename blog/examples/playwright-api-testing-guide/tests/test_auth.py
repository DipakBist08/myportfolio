from playwright.sync_api import APIRequestContext, Playwright


def test_401_without_a_token(anonymous_context: APIRequestContext):
    response = anonymous_context.get("/users/1")

    assert response.status == 401
    assert response.json() == {"error": "unauthorized"}


def test_401_with_an_invalid_token(playwright: Playwright, base_url: str):
    context = playwright.request.new_context(
        base_url=base_url,
        extra_http_headers={"Authorization": "Bearer not-a-real-token"},
    )
    try:
        assert context.get("/users/1").status == 401
    finally:
        context.dispose()


def test_viewer_can_read(viewer_context: APIRequestContext):
    assert viewer_context.get("/users/1").status == 200


def test_403_when_a_viewer_opens_an_admin_endpoint(viewer_context: APIRequestContext):
    response = viewer_context.get("/admin/settings")

    assert response.status == 403
    assert response.json() == {"error": "forbidden"}


def test_403_when_a_viewer_tries_to_write(viewer_context: APIRequestContext, api_context: APIRequestContext, unique_email: str):
    response = viewer_context.post("/users", data={"name": "Should Not Exist", "email": unique_email})

    assert response.status == 403
    # The status code alone is not enough: check that nothing was created.
    assert unique_email not in [user["email"] for user in api_context.get("/users").json()]
