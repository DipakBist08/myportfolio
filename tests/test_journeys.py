"""tests/test_journeys.py: the visitor's side of the page.

Can a reader understand it, navigate it, act on it, and trust it?
"""

import json
import re
from pathlib import Path

import pytest
from playwright.sync_api import BrowserContext, Page, expect

from helpers import scroll_through


# ----- first impression ----------------------------------------------------

def test_first_viewport_says_who_what_and_next(pg: Page, is_mobile: bool):
    pg.goto("/")
    h1 = pg.get_by_role("heading", level=1)
    expect(h1).to_contain_text("Dipak Bist")
    expect(h1).to_contain_text("Software QA Engineer")
    expect(pg.get_by_role("link", name=re.compile("view my work", re.I))).to_be_in_viewport()
    if not is_mobile:
        expect(pg.get_by_role("heading", name="test_login.py")).to_be_in_viewport()


def test_loads_cleanly(pg: Page):
    errors: list[str] = []
    failed: list[str] = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    pg.goto("/")
    scroll_through(pg)
    pg.wait_for_timeout(500)
    assert errors == []
    assert failed == []


def test_stylesheets_and_scripts_share_one_version():
    """Every local stylesheet and script URL carries the same ?v= tag.

    A browser that still holds older copies of the CSS or JS then fetches the
    current ones together with the new HTML, instead of rendering a mix.
    """
    root = Path(__file__).resolve().parent.parent
    refs: list[str] = []
    for name in ("index.html", "404.html"):
        refs += re.findall(r'(?:href|src)="/?((?:css|js)/[^"]+)"', (root / name).read_text(encoding="utf-8"))
    for module in sorted((root / "js").glob("*.js")):
        refs += re.findall(r"""from\s+['"]\./([^'"]+)['"]""", module.read_text(encoding="utf-8"))
    assert len(refs) >= 14, refs  # 3 stylesheets on each page, the entry script, 7 modules
    versions = {ref.partition("?v=")[2] for ref in refs}
    assert len(versions) == 1 and "" not in versions, sorted(refs)


def test_no_horizontal_scroll_on_narrow_screens(pg: Page):
    pg.set_viewport_size({"width": 320, "height": 700})
    pg.goto("/")
    scroll_through(pg)
    overflow = pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    assert overflow <= 0


def test_sections_show_content_not_test_scaffolding(pg: Page):
    """The hero's login example is the only test on the page. Sections carry no
    assertion lines, node ids or verdicts, and there is no results pill or panel."""
    pg.goto("/")
    expect(pg.locator(".assert, [data-check], #runchip, #runpanel")).to_have_count(0)
    assert pg.evaluate("() => typeof window.__portfolioSpec") == "undefined"
    scaffolding = re.compile(r"test_\w+\.py|::test_|\bPASSED\b|\bFAILED\b|test\.skip\(")
    for section in ["about", "workflow", "experience", "skills", "projects", "blog", "contact"]:
        expect(pg.locator(f"#{section}")).not_to_contain_text(scaffolding)
    # Projects without a public link say so in plain words, not code.
    expect(pg.locator("#projects .project__skip")).to_have_text(["Repository not public yet", "Internal work, no public link"])


# ----- the hero code panel ---------------------------------------------------

def test_hero_login_flow_runs_to_completion(pg: Page):
    pg.goto("/")
    flow = pg.get_by_role("region", name="test_login.py")
    result = flow.locator("#flow-result")
    expect(result).to_be_hidden()  # held back until the flow has run
    flow.scroll_into_view_if_needed()  # the run waits until the panel can be seen
    expect(flow.locator("#flow-status")).to_have_text("passed", timeout=15_000)
    expect(flow.locator("[data-step].is-done")).to_have_count(5)
    expect(result).to_be_visible()
    # pytest-playwright puts the browser in the node id of every test that uses `page`.
    expect(result).to_have_text(re.compile(r"^test_login\.py::test_login\[chromium\] PASSED \[100%\]$"))


def test_hero_flow_waits_until_it_can_be_seen(pg: Page):
    """On a short screen the panel starts below the fold, and its run waits there."""
    pg.set_viewport_size({"width": 412, "height": 640})
    pg.goto("/")
    pg.wait_for_timeout(3500)  # longer than the hero entrance plus the start delay
    expect(pg.locator("#flow-status")).to_have_text("ready")
    expect(pg.locator("#flow [data-step].is-done")).to_have_count(0)
    pg.locator("#flow").scroll_into_view_if_needed()
    expect(pg.locator("#flow-status")).to_have_text("passed", timeout=15_000)


def test_hero_code_is_a_valid_clean_test(pg: Page):
    pg.goto("/")
    code = pg.locator("#flow code").inner_text()
    compile(code, "test_login.py", "exec")  # raises on a syntax error
    lines = code.splitlines()
    assert max(len(line) for line in lines) <= 79  # PEP 8 line length
    assert all(line == line.rstrip() for line in lines)
    assert code.count("\n\n\n") == 2  # two blank lines before each top-level definition
    assert 'os.environ["USER_EMAIL"]' in code and "getenv" not in code  # a missing secret fails loudly
    assert "example.com" in code  # an example domain, not somebody's real site


def test_hero_flow_is_complete_at_once_with_reduced_motion(pg: Page):
    pg.emulate_media(reduced_motion="reduce")
    pg.goto("/")
    assert pg.evaluate("() => document.getElementById('flow').classList.contains('is-complete')")
    expect(pg.locator("#flow-status")).to_have_text("passed")


# What the hero flow shows at one instant, and the same read taken in the task that handles a click.
FLOW_STATE = """() => {
  const flow = document.getElementById('flow');
  return {
    status: document.getElementById('flow-status').textContent,
    done: flow.querySelectorAll('[data-step].is-done').length,
    running: flow.querySelectorAll('[data-step].is-running').length,
    complete: flow.classList.contains('is-complete'),
  };
}"""
RERUN_THEN_READ = "() => { document.querySelector('#flow [data-flow-rerun]').click(); return (" + FLOW_STATE + ")(); }"
FLOW_STARTED = {"status": "running", "done": 0, "running": 1, "complete": False}
FLOW_FINISHED = {"status": "passed", "done": 5, "running": 0, "complete": True}


def test_hero_flow_plays_again_on_rerun(pg: Page):
    pg.goto("/")
    flow = pg.get_by_role("region", name="test_login.py")
    announced = flow.locator("#flow-live")
    flow.scroll_into_view_if_needed()  # the run waits until the panel can be seen
    expect(flow.locator("#flow-status")).to_have_text("passed", timeout=15_000)
    expect(announced).to_be_empty()  # the run that starts by itself is not announced

    flow.get_by_role("button", name="Re-run").click()  # as a visitor would
    expect(announced).to_have_text("test_login.py passed")
    assert pg.evaluate(FLOW_STATE) == FLOW_FINISHED

    # Read in the task that handles the click: back at the first step, PASSED withdrawn.
    assert pg.evaluate(RERUN_THEN_READ) == FLOW_STARTED
    expect(announced).to_have_text("test_login.py passed")
    assert pg.evaluate(FLOW_STATE) == FLOW_FINISHED
    expect(flow.locator("#flow-result")).to_be_visible()


def test_hero_flow_restarts_cleanly_when_rerun_is_pressed_mid_run(pg: Page):
    pg.goto("/")
    pg.locator("#flow").scroll_into_view_if_needed()  # the run waits until the panel can be seen
    expect(pg.locator("#flow-status")).to_have_text("passed", timeout=15_000)
    most_running_at_once = pg.evaluate("""async () => {
  const flow = document.getElementById('flow');
  const button = flow.querySelector('[data-flow-rerun]');
  let most = 0;
  const watch = new MutationObserver(() => {
    most = Math.max(most, flow.querySelectorAll('[data-step].is-running').length);
  });
  watch.observe(flow, { subtree: true, attributes: true, attributeFilter: ['class'] });
  for (let press = 0; press < 3; press += 1) {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 700)); // into the second step
  }
  await new Promise((resolve) => {
    const check = () => (flow.classList.contains('is-complete') ? resolve() : setTimeout(check, 50));
    check();
  });
  watch.disconnect();
  return most;
}""")
    assert most_running_at_once == 1  # an abandoned run never steps alongside the new one
    assert pg.evaluate(FLOW_STATE) == FLOW_FINISHED


def test_hero_flow_reruns_on_request_with_reduced_motion(pg: Page):
    pg.emulate_media(reduced_motion="reduce")
    pg.goto("/")
    flow = pg.get_by_role("region", name="test_login.py")
    expect(flow.locator("#flow-status")).to_have_text("passed")
    flow.get_by_role("button", name="Re-run").press("Enter")  # by keyboard
    expect(flow.locator("#flow-live")).to_have_text("test_login.py passed")
    assert pg.evaluate(RERUN_THEN_READ) == FLOW_STARTED  # it plays step by step, as colour changes only
    expect(flow.locator("#flow-live")).to_have_text("test_login.py passed")


# Where each visual line of each step starts and ends, in px.
HERO_CODE_SHAPE = """() => {
  const pre = document.querySelector('#flow .flow__code');
  const probe = document.createElement('span');
  probe.textContent = '0'.repeat(20);
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  pre.querySelector('code').appendChild(probe);
  const ch = probe.getBoundingClientRect().width / 20;
  probe.remove();
  const steps = [...pre.querySelectorAll('.flow__step, .flow__wrap')].map((step) => {
    const range = document.createRange();
    range.selectNodeContents(step);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5).sort((a, b) => a.top - b.top);
    const lines = [];
    rects.forEach((r) => {
      const line = lines[lines.length - 1];
      if (line && r.top - line.top < 6) { line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right); }
      else lines.push({ top: r.top, left: r.left, right: r.right });
    });
    return { step: step.dataset.step || 'import', lines };
  });
  const box = pre.getBoundingClientRect();
  return { ch, steps, innerRight: box.right, scroll: pre.scrollWidth - pre.clientWidth };
}"""


def test_hero_code_keeps_its_shape(pg: Page, is_mobile: bool):
    """From 1280px every statement is one line. Narrower, a long statement
    soft-wraps at a call boundary with a hanging indent: the code on its first
    line never shrinks to bare indentation, its continuation is never flush
    left, and nothing runs past the panel, down to a 320px phone."""
    for width in ([None] if is_mobile else [1920, 1440, 1280, 1279, 1024, 768, 412, 360, 320]):
        if width:
            pg.set_viewport_size({"width": width, "height": 800})
        pg.goto("/")
        pg.evaluate("() => document.fonts.ready.then(() => true)")
        one_line = pg.evaluate("() => matchMedia('(min-width: 1280px)').matches")
        shape = pg.evaluate(HERO_CODE_SHAPE)
        ch = shape["ch"]
        assert len(shape["steps"]) == 6  # five steps and the import line
        assert shape["scroll"] <= 0, f"code scrolls sideways at {width}"
        for step in shape["steps"]:
            first, rest = step["lines"][0], step["lines"][1:]
            if one_line:
                assert not rest, f"step {step['step']} wraps at {width}"
            assert first["right"] - first["left"] >= 9 * ch, f"step {step['step']} starts with an empty line at {width}"
            for line in rest:
                assert line["left"] >= first["left"] + 5 * ch, f"step {step['step']} wraps flush left at {width}"
            assert all(line["right"] <= shape["innerRight"] for line in step["lines"]), f"step {step['step']} leaves the panel at {width}"


# ----- navigation and actions ---------------------------------------------

def test_each_nav_link_reaches_its_section(pg: Page, is_mobile: bool):
    pg.goto("/")
    for section in ["about", "workflow", "experience", "skills", "projects", "blog", "contact"]:
        if is_mobile:
            pg.get_by_role("button", name="Open menu").click()
        pg.locator(f'#nav-menu a[href="#{section}"]').click()
        expect(pg.locator(f"#{section}")).to_be_in_viewport(ratio=0.05)


def test_view_my_work_lands_on_real_safe_links(pg: Page):
    pg.goto("/")
    pg.get_by_role("link", name=re.compile("view my work", re.I)).click()
    expect(pg.locator("#projects")).to_be_in_viewport(ratio=0.05)
    links = pg.locator("#projects a.project__link")
    expect(links).to_have_count(3)
    for i in range(3):
        link = links.nth(i)
        expect(link).to_have_attribute("href", re.compile(r"^https://"))
        expect(link).to_have_attribute("rel", re.compile("noopener"))
        expect(link).to_have_attribute("target", "_blank")


def test_contact_email_and_copy(pg: Page, ctx: BrowserContext):
    pg.goto("/#contact")
    expect(pg.get_by_role("link", name="Send email")).to_have_attribute("href", "mailto:dipakbeest@gmail.com")
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    pg.get_by_role("button", name="Copy").click()
    expect(pg.get_by_role("button", name="Copied")).to_be_visible()
    assert pg.evaluate("() => navigator.clipboard.readText()") == "dipakbeest@gmail.com"


def test_subscribe_explains_before_sending(pg: Page):
    calls = []
    pg.route(
        "**/api/v1/subscribers/subscribe",
        lambda route: (calls.append(1), route.fulfill(status=202, content_type="application/json", body='{"detail": "Check your inbox to confirm."}')),
    )
    pg.goto("/")
    pg.locator("#subscribe-form").scroll_into_view_if_needed()
    pg.get_by_role("button", name="Subscribe").click()
    expect(pg.locator("#subscribe-hint")).to_have_text("Enter your email address.")
    pg.get_by_label("Email address").fill("nope")
    pg.get_by_role("button", name="Subscribe").click()
    expect(pg.locator("#subscribe-hint")).to_contain_text("like name@example.com")
    assert calls == []
    pg.get_by_label("Email address").fill("reader@example.com")
    pg.get_by_role("button", name="Subscribe").click()
    expect(pg.locator("#subscribe-feedback")).to_have_text("Check your inbox to confirm.")
    assert len(calls) == 1


def test_contact_form_validates_then_sends(pg: Page):
    sent: list[dict] = []

    def fake_formsubmit(route):
        sent.append(json.loads(route.request.post_data or "{}"))
        route.fulfill(status=200, content_type="application/json",
                      body='{"success": "true", "message": "The form was submitted successfully."}')

    pg.route("https://formsubmit.co/ajax/**", fake_formsubmit)
    pg.goto("/#contact")
    form = pg.locator("#contact-form")
    form.get_by_role("button", name="Send message").click()
    expect(pg.locator("#contact-name-error")).to_have_text("Enter your name.")
    expect(pg.locator("#contact-email-error")).to_contain_text("Enter your email address")
    expect(pg.locator("#contact-message-error")).to_have_text("Enter a message.")
    expect(form.get_by_label("Your name")).to_be_focused()
    assert sent == []

    form.get_by_label("Your name").fill("Recruiter")
    form.get_by_label("Your email").fill("recruiter@example.com")
    form.get_by_label("Message").fill("Hello, we have a QA role you may like.")
    form.get_by_role("button", name="Send message").click()
    expect(pg.locator("#contact-feedback")).to_contain_text("your message has been sent")
    assert len(sent) == 1
    assert sent[0]["email"] == sent[0]["_replyto"] == "recruiter@example.com"
    assert sent[0]["_honey"] == ""
    expect(form.get_by_label("Message")).to_have_value("")


def test_contact_form_reports_service_failure(pg: Page):
    pg.route("https://formsubmit.co/ajax/**", lambda route: route.abort())
    pg.goto("/#contact")
    form = pg.locator("#contact-form")
    form.get_by_label("Your name").fill("Recruiter")
    form.get_by_label("Your email").fill("recruiter@example.com")
    form.get_by_label("Message").fill("Hello, we have a QA role you may like.")
    form.get_by_role("button", name="Send message").click()
    expect(pg.locator("#contact-feedback")).to_contain_text("Couldn't reach the mail service")
    expect(form.get_by_label("Message")).to_have_value("Hello, we have a QA role you may like.")


# ----- themes and keyboard -------------------------------------------------

def test_theme_follows_system_until_chosen(pg: Page):
    pg.emulate_media(color_scheme="light")
    pg.goto("/")
    expect(pg.locator("html")).to_have_attribute("data-theme", "light")
    assert pg.evaluate("() => localStorage.getItem('portfolio-theme')") is None
    pg.get_by_role("button", name="Switch to dark theme").click()
    expect(pg.locator("html")).to_have_attribute("data-theme", "dark")
    pg.reload()
    expect(pg.locator("html")).to_have_attribute("data-theme", "dark")
    expect(pg.get_by_role("button", name="Switch to light theme")).to_have_attribute("aria-pressed", "false")


CONTRAST_SCAN = """() => {
  const lum = c => { const m = c.match(/[\\d.]+/g); if (!m) return null; const [r,g,b,a=1] = m.map(Number); if (a < 0.99) return null;
    return [r,g,b].map(v => { v /= 255; return v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4; }).reduce((s,v,i) => s + v*[0.2126,0.7152,0.0722][i], 0); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const L = lum(getComputedStyle(e).backgroundColor); if (L !== null) return L; } return lum(getComputedStyle(document.body).backgroundColor); };
  const out = [];
  document.querySelectorAll('body *').forEach(el => {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0 || el.closest('[aria-hidden="true"], [hidden], .visually-hidden')) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const fg = lum(s.color); const bg = bgOf(el); if (fg === null || bg === null) return;
    const cr = (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
    if (cr < (large ? 3 : 4.5)) out.push(cr.toFixed(2) + ' ' + el.tagName.toLowerCase() + '.' + [...el.classList].join('.'));
  });
  return [...new Set(out)];
}"""


@pytest.mark.parametrize("scheme", ["dark", "light"])
def test_text_keeps_aa_contrast(pg: Page, scheme: str):
    pg.emulate_media(color_scheme=scheme)
    pg.goto("/")
    scroll_through(pg)
    pg.locator("#flow").scroll_into_view_if_needed()
    expect(pg.locator("#flow-status")).to_have_text("passed", timeout=15_000)  # scan the hero in its finished state
    assert pg.evaluate(CONTRAST_SCAN) == []


def test_keyboard_only(pg: Page, is_mobile: bool):
    pg.goto("/")
    pg.keyboard.press("Tab")
    expect(pg.get_by_role("link", name="Skip to content")).to_be_focused()
    pg.keyboard.press("Enter")
    expect(pg.locator("#main")).to_be_focused()

    pg.goto("/")
    for _ in range(6):
        pg.keyboard.press("Tab")
        assert pg.evaluate("() => getComputedStyle(document.activeElement).boxShadow !== 'none'"), "focused control has no visible ring"

    if is_mobile:
        toggle = pg.get_by_role("button", name="Open menu")
        toggle.focus()
        pg.keyboard.press("Enter")
        expect(pg.get_by_role("button", name="Close menu")).to_have_attribute("aria-expanded", "true")
        expect(pg.locator("#nav-menu a").first).to_be_focused()
        assert pg.evaluate("() => document.getElementById('main').inert") is True
        pg.keyboard.press("Escape")
        expect(pg.get_by_role("button", name="Open menu")).to_be_focused()


def test_custom_404_page(pg: Page):
    pg.goto("/404.html")
    expect(pg.get_by_role("heading", level=1)).to_contain_text("404")
    expect(pg.get_by_role("link", name=re.compile("home page", re.I))).to_have_attribute("href", "/")


def test_link_preview_card_quotes_the_hero_verbatim(pg: Page):
    """The link-preview image (tools/og/og-image.html -> assets/og-image.png)
    shows two lines of the hero's test_login.py and its result line. If the
    hero changes, this fails until the card is updated and re-rendered."""
    card = (Path(__file__).resolve().parent.parent / "tools" / "og" / "og-image.html").read_text(encoding="utf-8")
    pg.set_content(card)
    quoted = [t.rstrip() for t in pg.locator("[data-quote]").all_inner_texts()]
    result = " ".join(pg.locator(".run").inner_text().split())
    assert len(quoted) == 2 and result.startswith("test_login.py::test_login")

    pg.goto("/")
    hero_lines = pg.locator("#flow code").inner_text().splitlines()
    hero_result = " ".join(pg.locator("#flow-result").text_content().split())
    for line in quoted:
        assert line in hero_lines, f"card quotes a line the hero does not show: {line!r}"
    assert result == hero_result, f"card result {result!r} != hero result {hero_result!r}"


# Boxes of the Workflow section, in page pixels.
WORKFLOW_SHAPE = """() => {
  const loop = document.querySelector('.workflow__loop');
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  return {
    loop_mode: getComputedStyle(loop.querySelector('.workflow__ring')).display !== 'none',
    loop: box(loop),
    aside: box(loop.querySelector('.workflow__aside')),
    bodies: [...loop.querySelectorAll('.step__body')].map(box),
    marks: [...loop.querySelectorAll('.step__mark')].map(box),
  };
}"""


def test_workflow_reads_in_order_as_a_loop_or_a_timeline(pg: Page, is_mobile: bool):
    """Wide: ten marks clockwise every 36 degrees from 01 at the top, with no
    text block touching another, the centre text or the section's edges.
    Narrow: a timeline, top to bottom in order. Either way, all ten tick."""
    import math

    for width in ([None] if is_mobile else [1440, 1280, 1100]):
        if width:
            pg.set_viewport_size({"width": width, "height": 1000})
        pg.goto("/")
        pg.evaluate("() => document.fonts.ready.then(() => true)")
        shape = pg.evaluate(WORKFLOW_SHAPE)
        bodies, loop = shape["bodies"], shape["loop"]
        assert len(bodies) == 10

        def apart(a, b, pad=4):
            return a["r"] + pad <= b["x"] or b["r"] + pad <= a["x"] or a["b"] + pad <= b["y"] or b["b"] + pad <= a["y"]

        for i, body in enumerate(bodies):
            assert loop["x"] - 1 <= body["x"] and body["r"] <= loop["r"] + 1, f"step {i + 1} leaves the section at {width}"
            for j in range(i + 1, 10):
                assert apart(body, bodies[j]), f"steps {i + 1} and {j + 1} touch at {width}"
        if shape["loop_mode"]:
            assert width is None or width >= 1280, f"loop at {width}, expected the timeline"
            cx, cy = loop["x"] + loop["w"] / 2, loop["y"] + loop["h"] / 2
            angles = [round((math.degrees(math.atan2(m["x"] + m["w"] / 2 - cx, cy - m["y"] - m["h"] / 2)) + 360) % 360)
                      for m in shape["marks"]]
            assert angles == [i * 36 for i in range(10)], angles
            assert all(apart(body, shape["aside"]) for body in bodies), f"a step touches the centre text at {width}"
            assert all(loop["y"] - 1 <= body["y"] and body["b"] <= loop["b"] + 1 for body in bodies)
        else:
            assert all(bodies[i + 1]["y"] > bodies[i]["b"] for i in range(9)), f"timeline out of order at {width}"

        pg.locator("#workflow .step").last.scroll_into_view_if_needed()
        expect(pg.locator("#steps-done")).to_have_text("10", timeout=10_000)
        expect(pg.locator("#workflow .step.is-done")).to_have_count(10)


# Fakes a tab switch: Playwright's headless pages always report "visible".
SET_TAB_HIDDEN = """(hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}"""

# Records every value the step counter shows from now on.
RECORD_COUNTER = """() => {
  window.__counter = [];
  window.__counterObserver?.disconnect();
  window.__counterObserver = new MutationObserver((records) => records.forEach((r) =>
    r.addedNodes.forEach((n) => window.__counter.push(n.textContent))));
  window.__counterObserver.observe(document.getElementById('steps-done'), { childList: true });
}"""


def test_workflow_plays_again_after_leaving_or_switching_tabs(pg: Page, is_mobile: bool):
    """Leaving the Workflow section (scrolled or jumped away, or another
    browser tab) resets it out of sight; coming back plays it again from 01,
    one step at a time. Hiding the tab mid-run stops that run."""
    steps = pg.locator("#workflow .step")
    ticked = pg.locator("#workflow .step.is-done")
    counter = pg.locator("#steps-done")
    loop = pg.locator("#workflow .workflow__loop")
    one_to_ten = [str(n) for n in range(1, 11)]

    def arrive():
        if is_mobile:
            steps.last.scroll_into_view_if_needed()
        else:
            pg.evaluate("document.getElementById('workflow').scrollIntoView({block: 'start'})")

    def expect_reset():
        expect(counter).to_have_text("0")
        expect(ticked).to_have_count(0)
        expect(loop).not_to_have_class(re.compile(r"\bis-drawn\b"))

    def expect_replay_from_01():
        expect(counter).to_have_text("10", timeout=10_000)
        expect(ticked).to_have_count(10)
        assert pg.evaluate("window.__counter") == one_to_ten

    pg.goto("/")
    arrive()
    expect(counter).to_have_text("10", timeout=10_000)
    if not is_mobile:
        expect(loop).to_have_class(re.compile(r"\bis-drawn\b"))

    # Away and back.
    pg.evaluate("scrollTo(0, 0)")
    expect_reset()
    pg.evaluate(RECORD_COUNTER)
    arrive()
    expect_replay_from_01()

    # Another tab, part-way through a run on the ring.
    pg.evaluate("scrollTo(0, 0)")
    expect_reset()
    arrive()
    if not is_mobile:
        expect(ticked).not_to_have_count(0)
        assert ticked.count() < 10, "the ring run should take a few seconds, not finish at once"
    pg.evaluate(SET_TAB_HIDDEN, True)
    expect_reset()
    pg.wait_for_timeout(600)
    assert counter.text_content() == "0", "a step ticked while the tab was hidden"
    pg.evaluate(RECORD_COUNTER)
    pg.evaluate(SET_TAB_HIDDEN, False)
    expect_replay_from_01()
