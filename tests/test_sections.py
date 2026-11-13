"""tests/test_sections.py: one content check per section of the page."""

import re

import pytest
from playwright.sync_api import Page, expect

from helpers import post_dates, role_dates


@pytest.fixture
def home(pg: Page) -> Page:
    pg.goto("/")
    return pg


def test_portrait_has_alt(home: Page):
    expect(home.locator("#about img")).to_have_attribute("alt", re.compile(r"\S"))


def test_workflow_has_ten_steps(home: Page):
    expect(home.locator("#workflow .step")).to_have_count(10)


def test_roles_chronological(home: Page):
    dates = role_dates(home)
    assert dates and dates == sorted(dates, reverse=True)


def test_evidence_links_safe(home: Page):
    expect(home.locator('#skills a[target="_blank"]:not([rel*="noopener"])')).to_have_count(0)


def test_project_links_secure(home: Page):
    expect(home.locator('#projects a.project__link:not([href^="https://"])')).to_have_count(0)
    # Projects without a public link say so, rather than faking one.
    expect(home.locator("#projects .project__skip")).to_have_count(2)


def test_posts_sorted_by_date(home: Page):
    dates = post_dates(home)
    assert dates and dates == sorted(dates, reverse=True)


def test_mailto_attached(home: Page):
    expect(home.locator('#contact a[href^="mailto:"]')).to_be_attached()
