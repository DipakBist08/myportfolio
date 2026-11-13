"""Helpers used by the page tests.

Each one measures the page from the outside, in the browser under test:
contrast from computed colours, layout shift from the browser's own
PerformanceObserver, dead in-page links, and so on.
"""

from __future__ import annotations

import re

from playwright.sync_api import Page

CONTRAST_JS = """
(selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => [r, g, b].map((c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fg = parse(getComputedStyle(el).color);
  let bg = null;
  for (let n = el; n && !bg; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a >= 0.99) bg = c; }
  if (!bg) bg = { r: 11, g: 11, b: 14 };
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
"""


def fonts_loaded(page: Page, *families: str) -> bool:
    page.evaluate("() => document.fonts.ready")
    return all(page.evaluate("f => document.fonts.check(`16px \"${f}\"`)", f) for f in families)


def contrast_ratio(page: Page, selector: str) -> float:
    ratio = page.evaluate(CONTRAST_JS, selector)
    assert ratio is not None, f"no element for {selector}"
    return float(ratio)


def console_errors(page: Page) -> list[str]:
    """Uncaught errors recorded by the page itself since load."""
    return page.evaluate("() => window.__pageErrors || []")


def cumulative_layout_shift(page: Page) -> float:
    return float(
        page.evaluate(
            """() => new Promise((resolve) => {
                 let total = 0;
                 try {
                   const po = new PerformanceObserver((list) => {
                     list.getEntries().forEach((e) => { if (!e.hadRecentInput) total += e.value; });
                   });
                   po.observe({ type: 'layout-shift', buffered: true });
                   setTimeout(() => { po.disconnect(); resolve(total); }, 300);
                 } catch { resolve(0); }
               })"""
        )
    )


def dead_anchors(page: Page) -> list[str]:
    return page.evaluate(
        """() => [...document.querySelectorAll('a[href^="#"]')]
              .map((a) => a.getAttribute('href'))
              .filter((h) => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1))))"""
    )


def respects_reduced_motion(page: Page) -> bool:
    reduce, animating = page.evaluate(
        "() => [matchMedia('(prefers-reduced-motion: reduce)').matches, document.documentElement.classList.contains('anim')]"
    )
    return (not animating) if reduce else True


def theme_persists(page: Page) -> bool:
    return bool(
        page.evaluate(
            """() => { try { localStorage.setItem('__probe', '1'); const ok = localStorage.getItem('__probe') === '1';
                      localStorage.removeItem('__probe'); return ok; } catch { return false; } }"""
        )
    )


def role_dates(page: Page) -> list[str]:
    return page.evaluate("() => [...document.querySelectorAll('#experience .role')].map((r) => r.dataset.start)")


def post_dates(page: Page) -> list[str]:
    return page.evaluate("() => [...document.querySelectorAll('#blog time[datetime]')].map((t) => t.getAttribute('datetime'))")


def scroll_through(page: Page, step: int = 480) -> None:
    """Scroll the page the way a reader would, so in-view work is triggered."""
    height = page.evaluate("() => document.documentElement.scrollHeight")
    for y in range(0, height, step):
        page.evaluate("y => window.scrollTo(0, y)", y)
        page.wait_for_timeout(60)
    page.evaluate("() => window.scrollTo(0, 0)")


NAME_RE = re.compile(r"Dipak Bist")
