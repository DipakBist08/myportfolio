"""tests/test_intro.py: the opening film on a first visit.

It plays the whole 48 s film once per browser session, over the page, as large
as the screen allows without cutting off any words, then uncovers it. Skip
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

    # The whole film, not a teaser: hello, photo, test run, skills, ring, career, end card.
    duration = pg.evaluate("() => document.querySelector('.intro-film__video').duration")
    assert 48 < duration < 49.5
    # Jump to its last moment rather than wait 48 s; it must end and uncover the page itself.
    pg.evaluate("() => { const v = document.querySelector('.intro-film__video'); v.currentTime = v.duration - 0.5; }")

    expect(film).to_have_count(0, timeout=5000)
    expect(pg.locator("html")).not_to_have_class(HAS_INTRO)
    expect(pg.get_by_role("heading", level=1)).to_be_visible()
    expect(pg.locator("#flow-status")).to_have_text("passed", timeout=12_000)
    assert pg.evaluate("() => getComputedStyle(document.body).overflow") != "hidden"
    assert pg.evaluate("() => sessionStorage.getItem('intro-seen')") == "1"
    assert pg.evaluate("() => window.__pageErrors") == []


# Film pixels the film may lose at each side and at top and bottom: js/intro.js
# keeps every word inside a centred 1840 x 990 area.
SAFE_CROP_X, SAFE_CROP_Y = 40, 45


@pytest.mark.parametrize("width, height", [(1440, 900), (1920, 950), (1280, 800), (412, 915)])
def test_film_is_as_large_as_the_screen_allows_without_cutting_words(browser: Browser, base_url: str, width: int, height: int):
    context = browser.new_context(base_url=base_url, viewport={"width": width, "height": height})
    pg = context.new_page()
    pg.goto("/")
    film_playing(pg, 0.1)
    box = pg.locator(".intro-film__video").bounding_box()
    scale = box["width"] / 1920
    assert abs(box["height"] - 1080 * scale) < 1
    contain = min(width / 1920, height / 1080)
    # Never smaller than the whole film fitted to the screen ...
    assert scale >= contain - 1e-3
    # ... and it fills the screen in at least one direction.
    assert box["width"] >= width - 1 or box["height"] >= height - 1
    # Whatever is cut off is bare scenery at the edges, never words.
    assert -box["x"] / scale <= SAFE_CROP_X + 0.5
    assert -box["y"] / scale <= SAFE_CROP_Y + 0.5
    assert box["x"] + box["width"] / 2 == pytest.approx(width / 2, abs=1)
    context.close()


def test_progress_line_shows_how_much_is_left(first_visit: BrowserContext):
    pg = first_visit.new_page()
    pg.goto("/")
    film_playing(pg, 1.0)
    progress = pg.locator(".intro-film__progress")
    expect(progress).to_have_attribute("aria-hidden", "true")
    pg.wait_for_function("() => new DOMMatrix(getComputedStyle(document.querySelector('.intro-film__progress')).transform).a > 0.02")
    shown = pg.evaluate("() => new DOMMatrix(getComputedStyle(document.querySelector('.intro-film__progress')).transform).a")
    assert 0 < shown < 0.5


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
