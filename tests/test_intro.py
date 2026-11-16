"""tests/test_intro.py: the opening film on a first visit.

It plays once per browser session, over the page, then uncovers it. Skip
intro or Esc ends it, it never plays with reduced motion, and a film that
cannot load never leaves the visitor stuck. Every other test in the suite
starts after the film (see conftest.py).
"""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, expect

HAS_INTRO = re.compile(r"\bhas-intro\b")


@pytest.fixture
def first_visit(browser: Browser, base_url: str) -> BrowserContext:
    """A visitor who has not seen the film this session."""
    context = browser.new_context(base_url=base_url, viewport={"width": 1440, "height": 900})
    yield context
    context.close()


def film_playing(pg: Page, past: float = 0.4) -> None:
    pg.wait_for_function(
        "t => { const v = document.querySelector('.intro-film__video'); return v && v.currentTime > t; }",
        arg=past, timeout=8000,
    )


def test_film_plays_then_uncovers_the_page_and_the_hero_starts(first_visit: BrowserContext):
    pg = first_visit.new_page()
    pg.goto("/")
    film = pg.locator("#intro-film")
    expect(film).to_be_visible()
    expect(pg.locator("html")).to_have_class(HAS_INTRO)
    film_playing(pg)
    # The hero's own run waits for the film: still "ready" behind it.
    expect(pg.locator("#flow-status")).to_have_text("ready")
    assert pg.evaluate("() => getComputedStyle(document.body).overflow") == "hidden"

    expect(film).to_have_count(0, timeout=14_000)
    expect(pg.locator("html")).not_to_have_class(HAS_INTRO)
    expect(pg.get_by_role("heading", level=1)).to_be_visible()
    expect(pg.locator("#flow-status")).to_have_text("passed", timeout=12_000)
    assert pg.evaluate("() => getComputedStyle(document.body).overflow") != "hidden"
    assert pg.evaluate("() => sessionStorage.getItem('intro-seen')") == "1"
    assert pg.evaluate("() => window.__pageErrors") == []


def test_film_plays_once_per_session(first_visit: BrowserContext):
    pg = first_visit.new_page()
    pg.goto("/")
    pg.get_by_role("button", name="Skip intro").click()
    expect(pg.locator("#intro-film")).to_have_count(0, timeout=3000)
    pg.reload()
    expect(pg.locator("html")).not_to_have_class(HAS_INTRO)
    expect(pg.locator("#intro-film")).to_have_count(0)


@pytest.mark.parametrize("how", ["button", "escape"])
def test_skip_intro_ends_it_at_once(first_visit: BrowserContext, how: str):
    pg = first_visit.new_page()
    pg.goto("/")
    film_playing(pg, 0.2)
    skip = pg.get_by_role("button", name="Skip intro")
    expect(skip).to_be_focused()
    if how == "button":
        skip.click()
    else:
        pg.keyboard.press("Escape")
    expect(pg.locator("#intro-film")).to_have_count(0, timeout=2000)
    expect(pg.get_by_role("heading", level=1)).to_be_visible()


def test_no_film_with_reduced_motion(browser: Browser, base_url: str):
    context = browser.new_context(base_url=base_url, reduced_motion="reduce")
    pg = context.new_page()
    pg.goto("/")
    expect(pg.locator("html")).not_to_have_class(HAS_INTRO)
    expect(pg.locator("#intro-film")).to_have_count(0)
    context.close()


def test_a_film_that_cannot_load_never_traps_the_page(first_visit: BrowserContext):
    pg = first_visit.new_page()
    pg.route("**/assets/intro/**", lambda route: route.abort())
    pg.goto("/")
    expect(pg.locator("#intro-film")).to_have_count(0, timeout=4000)
    expect(pg.get_by_role("heading", level=1)).to_be_visible()
    assert pg.evaluate("() => getComputedStyle(document.body).overflow") != "hidden"
