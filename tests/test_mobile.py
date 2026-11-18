"""tests/test_mobile.py: the smallest phones, where sections are tallest.

Sections fade in as they scroll into view. On a 320px-wide phone a long
section, like Professional Experience, is several screens tall, so a rule
such as "15% of it on screen" can never be met and the section would stay
blank. Scrolling through the page on the smallest common phone, with normal
and with enlarged text, must leave every part of every section visible.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Browser

# Every element that fades in, and every item of a group that fades in item by item.
STILL_HIDDEN = """() => [...document.querySelectorAll('[data-reveal]')]
  .flatMap((el) => [el, ...(el.hasAttribute('data-reveal-group') ? el.children : [])])
  .filter((el) => getComputedStyle(el).opacity === '0')
  .map((el) => `${el.closest('section, footer')?.id || el.tagName}: ${el.className}`)"""


@pytest.mark.parametrize("text_scale", ["100%", "150%"])
def test_every_section_appears_on_a_320px_phone(browser: Browser, base_url: str, text_scale: str):
    context = browser.new_context(base_url=base_url, viewport={"width": 320, "height": 568},
                                  is_mobile=True, has_touch=True, device_scale_factor=2)
    context.add_init_script("try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}")
    context.add_init_script(
        "document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '%s'; });" % text_scale)
    pg = context.new_page()
    pg.goto("/")
    pg.evaluate("() => document.fonts.ready.then(() => true)")
    experience = pg.evaluate("() => document.getElementById('experience').offsetHeight")
    assert experience > 568 / 0.15, "the case this guards: a section too tall for 15% of it to fit on screen"

    # Scroll the way a thumb does, top to bottom.
    height = pg.evaluate("() => document.documentElement.scrollHeight")
    for _ in range(0, height, 300):
        pg.mouse.wheel(0, 300)
        pg.wait_for_timeout(40)
    pg.wait_for_function(f"() => ({STILL_HIDDEN})().length === 0", timeout=5000)

    # And the experience roles are on screen when scrolled to, not just "not hidden".
    for role in pg.locator("#experience .role").all():
        role.scroll_into_view_if_needed()
        assert role.evaluate("el => getComputedStyle(el).opacity") == "1"
    assert pg.evaluate("() => document.documentElement.scrollWidth - innerWidth") == 0, "no sideways scrolling"
    context.close()
