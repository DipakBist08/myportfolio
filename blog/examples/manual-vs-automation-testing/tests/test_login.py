import re

from playwright.sync_api import Page, expect


def test_login_with_valid_credentials(page: Page):
    page.goto("/login")

    page.get_by_label("Email").fill("qa.user@example.com")
    page.get_by_label("Password").fill("correct-horse-battery")
    page.get_by_role("button", name="Sign in").click()

    expect(page).to_have_url(re.compile(r"/dashboard$"))
    expect(page.get_by_role("heading", level=1)).to_have_text("Welcome, QA User")


def test_login_with_wrong_password_shows_an_error(page: Page):
    page.goto("/login")

    page.get_by_label("Email").fill("qa.user@example.com")
    page.get_by_label("Password").fill("wrong-password")
    page.get_by_role("button", name="Sign in").click()

    expect(page.get_by_role("alert")).to_have_text("Email or password is incorrect.")
    expect(page).to_have_url(re.compile(r"/login$"))
