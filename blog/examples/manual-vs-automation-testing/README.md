# Example project: a first test to automate

The tested code behind [When to Automate a Test: A Practical Checklist](https://blog.dipakbist.com.np/blog/manual-vs-automation-testing).

- `app.py`: a tiny login app (`/login`, `/dashboard`), standard library only. It starts on a free local port when the tests start.
- `conftest.py`: overrides pytest-playwright's `base_url` fixture with the app's address, so tests can call `page.goto("/login")`.
- `tests/test_login.py`: sign-in with valid credentials, and with a wrong password.

## Run it

```bash
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
pytest -v
```

## Tested with

Playwright for Python 1.65.1, pytest-playwright 0.10.0, pytest 9.2.0, Chromium 158.0.8127.18, Python 3.12.3, on Linux (WSL), November 2026.

```text
tests/test_login.py::test_login_with_valid_credentials[chromium] PASSED  [ 50%]
tests/test_login.py::test_login_with_wrong_password_shows_an_error[chromium] PASSED [100%]

============================== 2 passed in 1.21s ===============================
```
