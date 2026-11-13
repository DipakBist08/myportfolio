"""tests/test_page.py: page-level checks.

Title, fonts, the hero in the first viewport, heading contrast, console
errors, layout shift, alt text, in-page links, reduced motion and theme
storage, each measured in a real browser on a desktop and a phone viewport.
"""

import re

from playwright.sync_api import Page, expect

from helpers import (
    console_errors,
    contrast_ratio,
    cumulative_layout_shift,
    dead_anchors,
    fonts_loaded,
    respects_reduced_motion,
    theme_persists,
)


def test_title(pg: Page):
    pg.goto("/")
    expect(pg).to_have_title(re.compile("Dipak Bist"))


def test_fonts_loaded(pg: Page):
    pg.goto("/")
    assert fonts_loaded(pg, "Bricolage Grotesque", "JetBrains Mono")


def test_hero_in_viewport(pg: Page):
    pg.goto("/")
    expect(pg.locator("#hero-heading")).to_be_in_viewport()


def test_h1_contrast(pg: Page):
    pg.goto("/")
    pg.wait_for_timeout(1200)  # let the entrance animation settle
    assert contrast_ratio(pg, "#hero-heading .hero__line") >= 4.5


def test_no_console_errors(pg: Page):
    pg.goto("/")
    pg.wait_for_timeout(1500)
    assert console_errors(pg) == []


def test_layout_shift(pg: Page):
    pg.goto("/")
    pg.wait_for_timeout(1500)
    assert cumulative_layout_shift(pg) < 0.1


def test_images_have_alt(pg: Page):
    pg.goto("/")
    expect(pg.locator("img:not([alt])")).to_have_count(0)


def test_anchors_resolve(pg: Page):
    pg.goto("/")
    assert dead_anchors(pg) == []


def test_reduced_motion(pg: Page):
    pg.emulate_media(reduced_motion="reduce")
    pg.goto("/")
    assert respects_reduced_motion(pg)
    hidden = pg.locator("[data-reveal]").evaluate_all("els => els.filter(el => getComputedStyle(el).opacity === '0').length")
    assert hidden == 0


def test_theme_persists(pg: Page):
    pg.goto("/")
    assert theme_persists(pg)
