import pytest
from jsonschema import Draft202012Validator, FormatChecker, ValidationError
from playwright.sync_api import APIRequestContext

USER_SCHEMA = {
    "type": "object",
    "required": ["id", "name", "email", "role"],
    "properties": {
        "id": {"type": "integer"},
        "name": {"type": "string", "minLength": 1},
        "email": {"type": "string", "format": "email"},
        "role": {"type": "string", "enum": ["admin", "editor", "viewer"]},
    },
    # Fail when the API starts returning a field nobody agreed on.
    "additionalProperties": False,
}

# "format" is only checked when a FormatChecker is passed in.
validator = Draft202012Validator(USER_SCHEMA, format_checker=FormatChecker())


def test_user_response_matches_schema(api_context: APIRequestContext):
    body = api_context.get("/users/1").json()

    validator.validate(body)  # raises ValidationError on a mismatch


def test_every_listed_user_matches_schema(api_context: APIRequestContext):
    for user in api_context.get("/users").json():
        validator.validate(user)


@pytest.mark.parametrize(
    "broken_user",
    [
        {"id": "1", "name": "Asha Rai", "email": "asha@example.com", "role": "admin"},  # id is a string
        {"id": 1, "name": "Asha Rai", "email": "not-an-email", "role": "admin"},  # bad email format
        {"id": 1, "name": "Asha Rai", "email": "asha@example.com", "role": "owner"},  # unknown role
        {"id": 1, "name": "Asha Rai", "email": "asha@example.com"},  # role is missing
        {"id": 1, "name": "Asha Rai", "email": "asha@example.com", "role": "admin", "password": "x"},  # extra field
    ],
)
def test_schema_rejects_a_broken_user(broken_user: dict):
    """Prove the schema can fail. A schema that accepts everything protects nothing."""
    with pytest.raises(ValidationError):
        validator.validate(broken_user)
