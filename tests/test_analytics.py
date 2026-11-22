"""tests/test_analytics.py: Google Analytics 4 runs only with consent.

Analytics is off until a measurement ID is set in index.html. With one, a
banner asks first; nothing from Google loads until the visitor allows it;
Decline is as easy as Allow; the choice is remembered; "Cookie settings"
changes it; Global Privacy Control is respected; and the banner fits a
320px phone with large text. Google is always stubbed: no test reaches it.
"""

from __future__ import annotations

import re

from playwright.sync_api import Browser, BrowserContext, Page, expect

GA_ID = "G-TEST123456"
GOOGLE = re.compile(r"^https://([a-z0-9-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)/")
NO_ID = '<meta name="ga-measurement-id" content="">'


def with_id(context: BrowserContext, base_url: str) -> list[str]:
    """Serve index.html with a measurement ID, let a local host load the
    (stubbed) Google script, and return the list of Google requests seen."""
    seen: list[str] = []
    context.add_init_script("window.__analyticsAllowLocal = true;")

    def html(route):
        res = route.fetch()
        body = res.text()
        assert NO_ID in body, "index.html should ship with an empty measurement ID"
        route.fulfill(response=res, body=body.replace(NO_ID, NO_ID.replace('content=""', f'content="{GA_ID}"')))

    def google(route):
        seen.append(route.request.url)
        route.fulfill(body="", content_type="text/javascript")

    context.route(base_url, html)
    context.route(GOOGLE, google)
    return seen


def consent_cookie(context: BrowserContext) -> str | None:
    return next((c["value"] for c in context.cookies() if c["name"] == "dipak_analytics_consent"), None)


def test_off_without_a_measurement_id(pg: Page, ctx: BrowserContext):
    seen: list[str] = []
    ctx.route(GOOGLE, lambda route: (seen.append(route.request.url), route.abort()))
    pg.goto("/")
    pg.wait_for_load_state("networkidle")
    expect(pg.locator(".consent")).to_have_count(0)
    expect(pg.locator(".footer__cookies")).to_have_count(0)
    assert seen == []


def test_asks_first_and_loads_nothing_until_allowed(pg: Page, ctx: BrowserContext, base_url: str):
    seen = with_id(ctx, base_url)
    pg.goto("/")
    banner = pg.get_by_role("region", name="Analytics cookies.")
    expect(banner).to_be_visible()
    expect(banner.get_by_role("link", name="Privacy policy")).to_have_attribute(
        "href", "https://blog.dipakbist.com.np/privacy-policy#analytics")
    pg.wait_for_load_state("networkidle")
    assert seen == [], "Google was contacted before the visitor chose"

    banner.get_by_role("button", name="Allow").click()
    expect(banner).to_be_hidden()
    pg.wait_for_function("() => document.querySelector('script[src*=\"googletagmanager.com/gtag/js\"]')")
    assert any(f"gtag/js?id={GA_ID}" in url for url in seen)
    assert consent_cookie(ctx) == "granted"
    # Advertising features stay off.
    config = pg.evaluate("() => [...window.dataLayer].map(a => [...a]).find(a => a[0] === 'config')")
    assert config == ["config", GA_ID, {"allow_google_signals": False, "allow_ad_personalization_signals": False}]

    # Remembered: the next page view loads analytics without asking again.
    seen.clear()
    pg.reload()
    pg.wait_for_function("() => document.querySelector('script[src*=\"googletagmanager.com/gtag/js\"]')")
    expect(pg.locator(".consent")).to_be_hidden()
    assert seen


def test_decline_is_one_click_and_remembered(pg: Page, ctx: BrowserContext, base_url: str):
    seen = with_id(ctx, base_url)
    pg.goto("/")
    banner = pg.get_by_role("region", name="Analytics cookies.")
    allow, decline = banner.get_by_role("button", name="Allow"), banner.get_by_role("button", name="Decline")
    # Same look for both choices: neither is pushed.
    assert allow.evaluate("el => el.className") == decline.evaluate("el => el.className")
    decline.click()
    expect(banner).to_be_hidden()
    assert consent_cookie(ctx) == "denied"
    pg.reload()
    pg.wait_for_load_state("networkidle")
    expect(pg.locator(".consent")).to_be_hidden()
    assert seen == []


def test_cookie_settings_changes_the_choice_and_clears_google_cookies(pg: Page, ctx: BrowserContext, base_url: str):
    with_id(ctx, base_url)
    pg.goto("/")
    pg.get_by_role("region", name="Analytics cookies.").get_by_role("button", name="Allow").click()
    # What Google Analytics would have set by now.
    pg.evaluate("() => { document.cookie = '_ga=GA1.1.1.1; path=/'; document.cookie = '_ga_TEST123456=GS1.1; path=/'; }")

    settings = pg.get_by_role("button", name="Cookie settings")
    settings.scroll_into_view_if_needed()
    settings.click()
    banner = pg.get_by_role("region", name="Analytics cookies.")
    expect(banner).to_be_visible()
    expect(banner.get_by_role("button", name="Decline")).to_be_focused()
    banner.get_by_role("button", name="Decline").click()

    assert consent_cookie(ctx) == "denied"
    assert [c["name"] for c in ctx.cookies() if c["name"].startswith("_ga")] == []
    assert pg.evaluate(f"() => window['ga-disable-{GA_ID}']") is True


def test_global_privacy_control_is_never_asked(browser: Browser, base_url: str):
    context = browser.new_context(base_url=base_url)
    context.add_init_script("try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}")
    context.add_init_script("Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });")
    seen = with_id(context, base_url)
    pg = context.new_page()
    pg.goto("/")
    pg.wait_for_load_state("networkidle")
    expect(pg.locator(".consent")).to_have_count(0)
    assert seen == []
    context.close()


def test_banner_fits_a_320px_phone_with_large_text(browser: Browser, base_url: str):
    context = browser.new_context(base_url=base_url, viewport={"width": 320, "height": 568},
                                  is_mobile=True, has_touch=True, device_scale_factor=2)
    context.add_init_script("try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}")
    context.add_init_script(
        "document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });")
    with_id(context, base_url)
    pg = context.new_page()
    pg.goto("/")
    banner = pg.get_by_role("region", name="Analytics cookies.")
    expect(banner).to_be_visible()
    box = banner.bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= 320 and box["y"] >= 0 and box["y"] + box["height"] <= 568
    # Both choices on screen without scrolling the banner.
    for name in ("Allow", "Decline"):
        expect(banner.get_by_role("button", name=name)).to_be_in_viewport(ratio=1)
    context.close()
