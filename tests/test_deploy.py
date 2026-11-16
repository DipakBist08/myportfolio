"""tests/test_deploy.py: what goes live, and the policy it runs under.

The repository also holds the blog, the CMS, tests and tooling, so the
portfolio is never served from its root: scripts/build-site.sh copies the
public files into site/, and Vercel (vercel.json "outputDirectory") and the
GitHub Pages workflow publish only that. The Content-Security-Policy in
vercel.json allows each inline script by its hash and nothing else inline.
tools/serve.py sends the same header, so every other test in this suite
also runs under it.
"""

from __future__ import annotations

import base64
import hashlib
import json
import posixpath
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.request import urlopen

import pytest
from playwright.sync_api import Page

from helpers import scroll_through

ROOT = Path(__file__).resolve().parent.parent
PAGES = ("index.html", "404.html", "admin/signin/index.html")
SITE = ("index.html", "404.html", "css/", "js/", "assets/", "admin/", "robots.txt", "sitemap.xml")
INLINE_SCRIPT = re.compile(r"<script\b(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>", re.S | re.I)
EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", re.I)


def _git(*args: str) -> set[str]:
    try:
        out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("needs a git checkout")
    return {line for line in out.splitlines() if line}


def published() -> set[str]:
    """What the deploy serves: the files scripts/build-site.sh puts in site/,
    built from a clean copy of the repository (tracked files, plus new ones
    git does not ignore), as on Vercel."""
    with tempfile.TemporaryDirectory() as tmp:
        for name in _git("ls-files", "--cached", "--others", "--exclude-standard"):
            if (ROOT / name).is_file():
                (Path(tmp) / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / name, Path(tmp) / name)
        subprocess.run(["sh", "scripts/build-site.sh"], cwd=tmp, check=True)
        site = Path(tmp) / "site"
        return {p.relative_to(site).as_posix() for p in site.rglob("*") if p.is_file()}


def _resolve(base_dir: str, ref: str) -> str | None:
    ref = ref.split("#")[0].split("?")[0]
    if not ref or EXTERNAL.match(ref):
        return None
    path = ref.lstrip("/") if ref.startswith("/") else posixpath.normpath(posixpath.join(base_dir, ref))
    if path in ("", ".") or path.endswith("/"):
        path = posixpath.join(path, "index.html").lstrip("./")
    return path


def local_references() -> set[str]:
    """Every site file the pages load: src/href in the HTML, module imports, url() in CSS."""
    refs: set[str] = set()
    for page in PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
            refs.add(_resolve(posixpath.dirname(page), ref))
    for module in (ROOT / "js").glob("*.js"):
        for ref in re.findall(r"""from\s+['"](\.[^'"]+)['"]""", module.read_text(encoding="utf-8")):
            refs.add(_resolve("js", ref))
    for sheet in (ROOT / "css").glob("*.css"):
        for ref in re.findall(r"""url\(\s*['"]?([^'")]+)""", sheet.read_text(encoding="utf-8")):
            refs.add(_resolve("css", ref))
    return refs - {None}


def csp() -> str:
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    return next(
        h["value"]
        for rule in config["headers"] if rule["source"] == "/(.*)"
        for h in rule["headers"] if h["key"] == "Content-Security-Policy"
    )


def directive(name: str) -> list[str]:
    for part in csp().split(";"):
        words = part.split()
        if words and words[0] == name:
            return words[1:]
    return []


# ----- what goes live ------------------------------------------------------

def test_deploys_publish_the_built_site_folder():
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    assert config["buildCommand"] == "sh scripts/build-site.sh"
    assert config["outputDirectory"] == "site"
    pages = (ROOT / ".github" / "workflows" / "static.yml").read_text(encoding="utf-8")
    assert "run: sh scripts/build-site.sh" in pages and "path: 'site'" in pages


def test_deploy_publishes_only_the_site():
    files = published()
    assert "index.html" in files
    assert sorted(f for f in files if not f.startswith(SITE)) == []
    private = re.compile(r"\.env|\.(py|ts|tsx|map|log)$|\.md$")
    assert sorted(f for f in files if private.search(f) and "LICENSE" not in f) == []


def test_every_file_the_pages_load_is_published():
    refs = local_references()
    assert {"css/site.css", "js/main.js", "assets/vendor/framer-motion-dom.js"} <= refs
    assert sorted(refs - published()) == []


# ----- Content-Security-Policy ---------------------------------------------

def test_csp_allows_exactly_the_inline_scripts_by_hash():
    script_src = directive("script-src")
    assert "'unsafe-inline'" not in script_src and "'unsafe-eval'" not in script_src
    expected = set()
    for page in PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        handlers = re.findall(r"<[^>]*\son[a-z]+\s*=", html, re.I)
        assert handlers == [], f"{page} has an inline event handler, which the CSP blocks"
        for body in INLINE_SCRIPT.findall(html):
            digest = base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode()
            expected.add(f"'sha256-{digest}'")
    # A changed inline script needs its new hash here, and the old one removed.
    assert {s for s in script_src if s.startswith("'sha256-")} == expected


def test_csp_locks_down_framing_plugins_and_base():
    assert directive("frame-ancestors") == ["'none'"]
    assert directive("object-src") == ["'none'"]
    assert directive("base-uri") == ["'self'"]


def test_local_server_sends_the_live_headers(base_url: str):
    with urlopen(base_url) as res:
        assert res.headers["Content-Security-Policy"] == csp()


@pytest.mark.parametrize("path", ["/", "/404.html"])
def test_pages_run_without_csp_violations(pg: Page, path: str):
    violations: list[str] = []
    pg.on("console", lambda m: violations.append(m.text) if "Content Security Policy" in m.text else None)
    pg.add_init_script(
        "document.addEventListener('securitypolicyviolation', e => console.error("
        "'Content Security Policy violation: ' + e.violatedDirective + ' ' + e.blockedURI))"
    )
    pg.goto(path)
    scroll_through(pg)
    pg.wait_for_timeout(300)
    assert violations == []


def test_admin_sign_in_hands_over_to_the_cms(pg: Page):
    pg.route("https://cms.dipakbist.com.np/**", lambda route: route.fulfill(body="cms", content_type="text/html"))
    violations: list[str] = []
    pg.on("console", lambda m: violations.append(m.text) if "Content Security Policy" in m.text else None)
    pg.goto("/admin/signin/")
    pg.wait_for_url("https://cms.dipakbist.com.np/**")
    assert violations == []
