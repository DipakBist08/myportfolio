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


def test_skills_cards_in_owner_order(home: Page):
    expect(home.locator("#skills .skill__title")).to_have_text([
        "Manual & Functional Testing",
        "Test Automation",
        "API Testing",
        "AI-Assisted QA & AI Feature Testing",
        "Test Management & Agile QA",
        "Performance Testing",
        "Databases & Version Control",
    ])
    # Every card except Manual & Functional Testing lists its tools as text.
    expect(home.locator("#skills .skill__tools")).to_have_count(6)


def test_evidence_links_safe(home: Page):
    expect(home.locator('#skills a[target="_blank"]:not([rel*="noopener"])')).to_have_count(0)


def test_project_links_secure(home: Page):
    expect(home.locator('#projects a.project__link:not([href^="https://"])')).to_have_count(0)
    # Projects without a public link say so, rather than faking one.
    expect(home.locator("#projects .project__skip")).to_have_count(1)


def test_worked_projects_in_owner_order(home: Page):
    """The owner's worked projects, each its own card like FigsFlow (19/11/2026): FigsFlow, AakashTel,
    Moru-Digital Wallet. Each shows its logo small (a 50px tile) and links to the product's site."""
    cards = home.locator("#projects .project--featured")
    expect(cards.locator(".project__title")).to_have_text(["FigsFlow", "AakashTel", "Moru-Digital Wallet"])
    for i, url in enumerate(["https://figsflow.com", "https://aakashtel.com/", "https://www.moru.com.np/home"]):
        card = cards.nth(i)
        card.scroll_into_view_if_needed()
        expect(card.locator("a.project__link")).to_have_attribute("href", url)
        logo = card.locator(".project__media img")
        expect(logo).to_have_attribute("alt", re.compile(r"\S+ logo$"))
        home.wait_for_function("(img) => img.complete && img.naturalWidth > 0", arg=logo.element_handle())
        box = card.locator(".project__media").bounding_box()
        assert box and 40 <= box["height"] <= 60, f"logo tile {i} is {box}"


def test_posts_sorted_by_date(home: Page):
    dates = post_dates(home)
    assert dates and dates == sorted(dates, reverse=True)


def test_mailto_attached(home: Page):
    expect(home.locator('#contact a[href^="mailto:"]')).to_be_attached()
