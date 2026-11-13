# Example project: Playwright API testing in Python

The tested code behind [Playwright API Testing in Python, No Browser Needed](https://blog.dipakbist.com.np/blog/playwright-api-testing-guide).

- `mock_api.py`: a small users REST API, standard library only. It starts on a free local port when the tests start, so the tests run anywhere with no account and no network.
- `conftest.py`: one `APIRequestContext` per role (admin, viewer, anonymous), unique test data, and cleanup.
- `tests/`: 25 tests. Reads, writes, JSON Schema checks, 401 and 403, and negative cases.

## Run it

```bash
python -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest -v
```

There is no `playwright install` step: API tests never start a browser.

To run the tests against another API, set `API_BASE_URL`, `API_TOKEN` and `API_VIEWER_TOKEN`. The expectations (user 1, the 400 and 422 split) match the mock's contract, so change them to match your API's documentation first.

## Tested with

Playwright for Python 1.65.1, pytest-playwright 0.10.0, pytest 9.2.0, jsonschema 4.26.0, Python 3.12.3, on Linux (WSL), November 2026.

The suite was run in two ways, and both passed:

1. Normally: `25 passed in 2.88s`.
2. With Playwright pointed at an empty browser folder (`PLAYWRIGHT_BROWSERS_PATH=<empty dir>`) and with `API_BASE_URL=` and `API_TOKEN=` set to empty strings, as CI does when a variable or secret is missing: `25 passed in 2.47s`. This is the evidence for "no browser needed".

The GitHub Actions workflow in the article was checked for syntax, and the commands it runs are the ones above. It was not run on GitHub's servers for this article.
