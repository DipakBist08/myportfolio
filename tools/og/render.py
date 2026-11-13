#!/usr/bin/env python3
"""Render the site's link-preview image (the Open Graph card) from HTML.

    .venv/bin/python tools/og/render.py
        renders tools/og/og-image.html to assets/og-image.png

    .venv/bin/python tools/og/render.py SOURCE.html OUTPUT.png [--previews DIR]
        renders any card source; --previews also writes the crops and sizes
        that social platforms show (see PREVIEWS below)

The card is rendered at exactly 1200x630 (device scale 1) with the site's own
self-hosted fonts and stylesheets, served straight from this repository: the
source refers to them with root-relative URLs such as /css/tokens.css.
Nothing is fetched from the network.

The render fails, and leaves OUTPUT untouched, when:
  * a piece of text is not set in a loaded web font (a silent fallback to a
    system font would change the design);
  * two separate pieces of text overlap, or come closer than MIN_GAP px
    (the previous card ran "...Surprises()" straight into "Playwright");
  * text comes closer than SAFE_MARGIN px to an edge of the card;
  * the PNG is larger than MAX_BYTES (300 KB, the commonly cited ceiling
    for WhatsApp link previews).
Distances are measured on the glyphs' ink, not on the line boxes, so tight
display type doesn't trip the check. Text inside one block (a heading, a
line of copy) may touch itself; text in different blocks may not. Mark
purely decorative text with data-og-ignore to exempt it.
"""

from __future__ import annotations

import argparse
import base64
import shutil
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import Route, sync_playwright

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO / "tools" / "og" / "og-image.html"
DEFAULT_OUTPUT = REPO / "assets" / "og-image.png"

WIDTH, HEIGHT = 1200, 630
SAFE_MARGIN = 40
MIN_GAP = 12
MAX_BYTES = 300 * 1024

ORIGIN = "http://og.local"
PAGE_PATH = "/__card__.html"

# How platforms show a 1200x630 card: (crop box x, y, w, h) or None, then output width.
PREVIEWS = {
    "x-2to1.png": ((0, 15, 1200, 600), None),  # X / Twitter large card: centre 2:1
    "square-crop.png": ((285, 0, 630, 630), None),  # small square thumbnails: centre crop
    "linkedin-feed.png": (None, 552),  # LinkedIn desktop feed width
    "small-300.png": (None, 300),  # compact chat previews
}

MEASURE_JS = """
() => {
  const loaded = new Set([...document.fonts]
    .filter((f) => f.status === 'loaded')
    .map((f) => f.family.replace(/["']/g, '').trim()));
  const ctx = document.createElement('canvas').getContext('2d');
  const blocks = new Map();
  const runs = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\\s+/g, ' ').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || el.closest('[data-og-ignore]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    // A block is the nearest ancestor that isn't an inline box.
    let block = el;
    while (block !== document.body && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
    if (!blocks.has(block)) blocks.set(block, blocks.size);
    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(text);
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 0.5 || r.height < 0.5) continue;
      // Ink box: the line box narrowed to the glyphs' actual ascent and descent.
      const baseline = r.top + m.fontBoundingBoxAscent;
      runs.push({
        text: text.slice(0, 48),
        block: blocks.get(block),
        family,
        fontLoaded: loaded.has(family),
        x: r.left,
        y: baseline - m.actualBoundingBoxAscent,
        w: r.width,
        h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
      });
    }
  }
  return { runs, loaded: [...loaded], size: [innerWidth, innerHeight] };
}
"""


def serve_repo(src: Path):
    """Route handler: the card at PAGE_PATH, repository files at their own paths, nothing else."""

    def handle(route: Route) -> None:
        url = urlparse(route.request.url)
        if f"{url.scheme}://{url.netloc}" != ORIGIN:
            route.abort()
            return
        path = unquote(url.path)
        if path == PAGE_PATH:
            route.fulfill(path=str(src), content_type="text/html; charset=utf-8")
            return
        target = (REPO / path.lstrip("/")).resolve()
        if REPO in target.parents and target.is_file():
            route.fulfill(path=str(target))
        else:
            route.fulfill(status=404, body=f"not in repository: {path}")

    return handle


def check_layout(measured: dict) -> list[str]:
    problems = []
    if measured["size"] != [WIDTH, HEIGHT]:
        problems.append(f"viewport is {measured['size']}, expected {[WIDTH, HEIGHT]}")
    runs = measured["runs"]
    if not runs:
        problems.append("no text found on the card")
    for r in runs:
        if not r["fontLoaded"]:
            problems.append(f'"{r["text"]}" is set in "{r["family"]}", which is not a loaded web font '
                            f'(loaded: {", ".join(measured["loaded"]) or "none"})')
        if (r["x"] < SAFE_MARGIN or r["y"] < SAFE_MARGIN
                or r["x"] + r["w"] > WIDTH - SAFE_MARGIN or r["y"] + r["h"] > HEIGHT - SAFE_MARGIN):
            problems.append(f'"{r["text"]}" is within {SAFE_MARGIN}px of the edge '
                            f'(ink box x={r["x"]:.0f} y={r["y"]:.0f} w={r["w"]:.0f} h={r["h"]:.0f})')
    for i, a in enumerate(runs):
        for b in runs[i + 1:]:
            if a["block"] == b["block"]:
                continue
            dx = max(0.0, max(a["x"], b["x"]) - min(a["x"] + a["w"], b["x"] + b["w"]))
            dy = max(0.0, max(a["y"], b["y"]) - min(a["y"] + a["h"], b["y"] + b["h"]))
            if dx < MIN_GAP and dy < MIN_GAP:
                what = "overlaps" if dx == 0 and dy == 0 else f"is {max(dx, dy):.0f}px from"
                problems.append(f'"{a["text"]}" {what} "{b["text"]}" (minimum gap {MIN_GAP}px)')
    return problems


def write_previews(browser, card_png: Path, page, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    data = base64.b64encode(card_png.read_bytes()).decode()
    for name, (clip, width) in PREVIEWS.items():
        if clip:
            x, y, w, h = clip
            page.screenshot(path=str(out_dir / name), clip={"x": x, "y": y, "width": w, "height": h})
        else:
            height = round(width * HEIGHT / WIDTH)
            thumb = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            thumb.set_content(f'<body style="margin:0"><img src="data:image/png;base64,{data}" '
                              f'style="display:block;width:{width}px;height:{height}px"></body>')
            thumb.screenshot(path=str(out_dir / name))
            thumb.close()


def render(src: Path, out: Path, previews: Path | None) -> int:
    if not src.is_file():
        print(f"render: no such source: {src}", file=sys.stderr)
        return 2
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.route("**/*", serve_repo(src.resolve()))
        page.goto(f"{ORIGIN}{PAGE_PATH}", wait_until="load")
        page.evaluate("() => document.fonts.ready")
        page.wait_for_timeout(150)
        page.evaluate("() => document.fonts.ready")
        measured = page.evaluate(MEASURE_JS)
        problems = check_layout(measured)

        with tempfile.TemporaryDirectory() as tmp:
            shot = Path(tmp) / "card.png"
            page.screenshot(path=str(shot), clip={"x": 0, "y": 0, "width": WIDTH, "height": HEIGHT})
            size = shot.stat().st_size
            if size > MAX_BYTES:
                problems.append(f"PNG is {size / 1024:.0f} KB, above the {MAX_BYTES // 1024} KB ceiling")
            if previews:
                write_previews(browser, shot, page, previews)
            browser.close()

            runs = measured["runs"]
            print(f"card: {src}")
            print(f"  {WIDTH}x{HEIGHT}, {size / 1024:.0f} KB, {len(runs)} text runs, "
                  f"fonts loaded: {', '.join(sorted(measured['loaded'])) or 'none'}")
            if problems:
                print(f"FAILED: {len(problems)} problem(s); {out} was not written")
                for prob in problems:
                    print(f"  - {prob}")
                return 1
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(shot, out)
            print(f"  wrote {out}")
            if previews:
                print(f"  previews in {previews}: {', '.join(PREVIEWS)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("source", nargs="?", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("output", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--previews", type=Path, help="also write platform crops and sizes here")
    args = parser.parse_args()
    return render(args.source.resolve(), args.output.resolve(), args.previews)


if __name__ == "__main__":
    sys.exit(main())
