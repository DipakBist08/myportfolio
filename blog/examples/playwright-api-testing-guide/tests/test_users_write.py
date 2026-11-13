from playwright.sync_api import APIRequestContext, expect


def test_create_user(api_context: APIRequestContext, unique_email: str):
    payload = {"name": "QA Tester", "email": unique_email, "role": "viewer"}

    response = api_context.post("/users", data=payload)  # a dict is sent as JSON

    assert response.status == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert {key: body[key] for key in payload} == payload

    api_context.delete(f"/users/{body['id']}")  # clean up what this test created


def test_update_user_email(api_context: APIRequestContext, created_user: dict, unique_email: str):
    new_email = f"updated-{unique_email}"

    response = api_context.patch(f"/users/{created_user['id']}", data={"email": new_email})

    expect(response).to_be_ok()
    assert response.json()["email"] == new_email
    # Read it back: the update must be stored, not only echoed in the response.
    assert api_context.get(f"/users/{created_user['id']}").json()["email"] == new_email


def test_delete_user(api_context: APIRequestContext, created_user: dict):
    user_url = f"/users/{created_user['id']}"

    delete_response = api_context.delete(user_url)
    assert delete_response.status == 204

    assert api_context.get(user_url).status == 404  # it is really gone
    assert api_context.delete(user_url).status == 404  # deleting twice is not a success
