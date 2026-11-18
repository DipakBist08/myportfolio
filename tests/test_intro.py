"""tests/test_intro.py: the opening film on a first visit.

It plays the whole 30 s film once per browser session, over the page, as large
as the screen allows without cutting off any words, then uncovers it. A screen
taller than it is wide (a phone held upright) gets the 1080x1920 phone cut;
every other screen gets the 1920x1080 one. Skip intro or Esc ends it, it never
plays with reduced motion, and a film that cannot load never leaves the visitor
stuck. Every other test in the suite starts after the film (see conftest.py).
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


# Which cut is on screen: the playing video's own size, and whether it is the phone cut's file.
FILM_SHOWN = """() => { const v = document.querySelector('.intro-film__video');
  return { width: v.videoWidth, height: v.videoHeight, phone_cut: v.currentSrc.includes('intro-portrait') }; }"""


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

    # The whole film, not a teaser: test run, PASSED, the workflow ring, the end card.
    duration = pg.evaluate("() => document.querySelector('.intro-film__video').duration")
    assert 29.5 < duration < 30.5
    # A wide screen gets the landscape cut.
    assert pg.evaluate(FILM_SHOWN) == {"width": 1920, "height": 1080, "phone_cut": False}
    # Jump to its last moment rather than wait 30 s; it must end and uncover the page itself.
    pg.evaluate("() => { const v = document.querySelector('.intro-film__video'); v.currentTime = v.duration - 0.5; }")

    expect(film).to_have_count(0, timeout=5000)
    expect(pg.locator("html")).not_to_have_class(HAS_INTRO)
    expect(pg.get_by_role("heading", level=1)).to_be_visible()
    expect(pg.locator("#flow-status")).to_have_text("passed", timeout=12_000)
    assert pg.evaluate("() => getComputedStyle(document.body).overflow") != "hidden"
    assert pg.evaluate("() => sessionStorage.getItem('intro-seen')") == "1"
    assert pg.evaluate("() => window.__pageErrors") == []


# The two cuts (js/intro.js FILMS): each one's size, and the film pixels it may
# lose at each side and at top and bottom. Every word stays inside the centred
# area that is left (1840 x 990, and 1080 x 1780 for the phone cut, which is
# never cropped at the sides).
LANDSCAPE = {"w": 1920, "h": 1080, "crop_x": 40, "crop_y": 45}
PHONE = {"w": 1080, "h": 1920, "crop_x": 0, "crop_y": 70}


@pytest.mark.parametrize("width, height", [(1440, 900), (1920, 950), (1280, 800), (1000, 1000),
                                           (412, 915), (390, 844), (320, 568), (768, 1024)])
def test_film_is_as_large_as_the_screen_allows_without_cutting_words(browser: Browser, base_url: str, width: int, height: int):
    context = browser.new_context(base_url=base_url, viewport={"width": width, "height": height})
    pg = context.new_page()
    pg.goto("/")
    film_playing(pg, 0.1)
    # Taller than wide: the phone cut. Otherwise the landscape one.
    film = PHONE if height > width else LANDSCAPE
    assert pg.evaluate(FILM_SHOWN) == {"width": film["w"], "height": film["h"], "phone_cut": film is PHONE}
    box = pg.locator(".intro-film__video").bounding_box()
    scale = box["width"] / film["w"]
    assert abs(box["height"] - film["h"] * scale) < 1
    contain = min(width / film["w"], height / film["h"])
    # Never smaller than the whole film fitted to the screen ...
    assert scale >= contain - 1e-3
    # ... and it fills the screen in at least one direction.
    assert box["width"] >= width - 1 or box["height"] >= height - 1
    # Whatever is cut off is bare scenery at the edges, never words.
    assert -box["x"] / scale <= film["crop_x"] + 0.5
    assert -box["y"] / scale <= film["crop_y"] + 0.5
    assert box["x"] + box["width"] / 2 == pytest.approx(width / 2, abs=1)
    context.close()


def test_a_phone_held_upright_plays_the_phone_cut_to_the_end(browser: Browser, base_url: str):
    """On a phone the 1920x1080 film is a strip a fifth of the screen tall, its code too small to read."""
    context = browser.new_context(base_url=base_url, viewport={"width": 390, "height": 844},
                                  is_mobile=True, has_touch=True, device_scale_factor=3)
    pg = context.new_page()
    pg.goto("/")
    film_playing(pg)
    assert pg.evaluate(FILM_SHOWN) == {"width": 1080, "height": 1920, "phone_cut": True}
    box = pg.locator(".intro-film__video").bounding_box()
    assert box["width"] == pytest.approx(390, abs=1), "it uses the phone's full width"
    assert box["height"] > 0.8 * 844, "and most of its height"
    # Only the cut that plays is downloaded.
    fetched = pg.evaluate("() => performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('/assets/intro/'))")
    assert fetched and all("intro-portrait" in name for name in fetched), fetched
    duration = pg.evaluate("() => document.querySelector('.intro-film__video').duration")
    assert 29.5 < duration < 30.5
    pg.evaluate("() => { const v = document.querySelector('.intro-film__video'); v.currentTime = v.duration - 0.5; }")
    expect(pg.locator("#intro-film")).to_have_count(0, timeout=5000)
    expect(pg.get_by_role("heading", level=1)).to_be_visible()
    assert pg.evaluate("() => getComputedStyle(document.body).overflow") != "hidden"
    assert pg.evaluate("() => window.__pageErrors") == []
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
