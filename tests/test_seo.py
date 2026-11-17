"""tests/test_seo.py: what search engines read in the page's own HTML.

Recruiters search Dipak's name, so the page must say plainly, without
JavaScript, who he is and which profiles are his. These checks read the
files as served, with no browser: the structured data is one connected
graph whose Person carries the @id the blog's posts name as their author,
and his profile links say they are his (rel="me").
"""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PERSON_ID = "https://dipakbist.com.np/#person"
PROFILES = (
    "https://www.linkedin.com/in/dipakbist",
    "https://github.com/DipakBist08",
    "https://www.instagram.com/dipak.beest/",
)
OUTDATED = ("linkedin.com/in/dipakbist08", "61585825412139")


class _Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.anchors: list[dict[str, str]] = []
        self.jsonld: list[str] = []
        self.h1: list[str] = []
        self._in_jsonld = False
        self._in_h1 = False
        self._buf = ""

    def handle_starttag(self, tag, attrs):
        a = {k: v or "" for k, v in attrs}
        if tag == "meta":
            self.meta.append(a)
        elif tag == "link":
            self.links.append(a)
        elif tag == "a":
            self.anchors.append(a)
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._in_jsonld, self._buf = True, ""
        elif tag == "h1":
            self._in_h1, self._buf = True, ""

    def handle_endtag(self, tag):
        if tag == "script" and self._in_jsonld:
            self.jsonld.append(self._buf)
            self._in_jsonld = False
        elif tag == "h1" and self._in_h1:
            self.h1.append(" ".join(self._buf.split()))
            self._in_h1 = False

    def handle_data(self, data):
        if self._in_jsonld or self._in_h1:
            self._buf += data


def page() -> _Page:
    p = _Page()
    p.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    return p


def graph() -> list[dict]:
    blocks = page().jsonld
    assert len(blocks) == 1, "one JSON-LD block, holding one connected @graph"
    data = json.loads(blocks[0])
    return data["@graph"]


def test_structured_data_names_one_person_with_the_blogs_author_id():
    nodes = graph()
    people = [n for n in nodes if n.get("@type") == "Person"]
    assert len(people) == 1, "exactly one Person"
    person = people[0]
    assert person["@id"] == PERSON_ID
    assert person["name"] == "Dipak Bist"
    assert person["jobTitle"] == "Software QA Engineer"
    assert person["url"] == "https://dipakbist.com.np/"
    assert person["description"].startswith("Software QA Engineer based in Kathmandu, Nepal")
    # sameAs holds his own profiles only: no outdated URLs, no blog (that is a Blog node).
    assert set(PROFILES) <= set(person["sameAs"])
    assert not any(o in url for url in person["sameAs"] for o in OUTDATED)
    assert not any("blog.dipakbist.com.np" in url for url in person["sameAs"])


def test_every_reference_in_the_graph_points_at_a_node_in_it():
    nodes = graph()
    ids = {n["@id"] for n in nodes}
    refs = set()

    def walk(value):
        if isinstance(value, dict):
            if set(value) == {"@id"}:
                refs.add(value["@id"])
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for v in value:
                walk(v)

    walk(nodes)
    assert refs and refs <= ids, f"dangling references: {sorted(refs - ids)}"
    by_type = {n["@type"]: n for n in nodes}
    assert by_type["ProfilePage"]["mainEntity"] == {"@id": PERSON_ID}
    assert by_type["WebSite"]["publisher"] == {"@id": PERSON_ID}
    assert by_type["Blog"]["@id"] == "https://blog.dipakbist.com.np/#blog"
    assert by_type["Organization"]["founder"] == {"@id": PERSON_ID}


def test_head_tells_search_engines_what_this_page_is():
    p = page()
    assert p.h1 == ["Dipak Bist Software QA Engineer"]
    canonical = [l["href"] for l in p.links if l.get("rel") == "canonical"]
    assert canonical == ["https://dipakbist.com.np/"]
    robots = [m["content"] for m in p.meta if m.get("name") == "robots"]
    assert robots == ["index, follow, max-image-preview:large"]
    assert not [m for m in p.meta if m.get("name") == "keywords"], "no meta keywords"


def test_profile_links_say_they_are_his():
    p = page()
    for a in p.anchors:
        href = a.get("href", "")
        if href.rstrip("/") in {u.rstrip("/") for u in PROFILES}:
            rel = a.get("rel", "").split()
            assert "me" in rel, f"{href} lacks rel=me"
            assert "noopener" in rel
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for old in OUTDATED:
        assert old not in html


def test_icons_for_search_results_and_home_screens():
    p = page()
    rels = {(l.get("rel"), l.get("href")) for l in p.links}
    assert ("icon", "/favicon.ico") in rels
    assert ("icon", "assets/favicon.svg") in rels
    assert ("apple-touch-icon", "assets/apple-touch-icon.png") in rels
    assert ("manifest", "assets/site.webmanifest") in rels
    ico = (ROOT / "favicon.ico").read_bytes()
    assert ico[:4] == b"\x00\x00\x01\x00", "favicon.ico is an ICO file"
    manifest = json.loads((ROOT / "assets" / "site.webmanifest").read_text(encoding="utf-8"))
    assert manifest["name"].startswith("Dipak Bist")
    for icon in manifest["icons"]:
        assert (ROOT / "assets" / icon["src"]).is_file(), icon["src"]


def test_sitemap_gets_a_lastmod_at_build_time(tmp_path):
    import shutil
    import subprocess

    for name in ("index.html", "404.html", "robots.txt", "sitemap.xml", "favicon.ico", "scripts/build-site.sh"):
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, tmp_path / name)
    for folder in ("css", "js", "assets", "admin"):
        shutil.copytree(ROOT / folder, tmp_path / folder)
    subprocess.run(["sh", "scripts/build-site.sh"], cwd=tmp_path, check=True)
    xml = (tmp_path / "site" / "sitemap.xml").read_text(encoding="utf-8")
    entry = re.search(r"<loc>https://dipakbist\.com\.np/</loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>", xml)
    assert entry, "the homepage entry carries a <lastmod> date"
    # The source file is left alone; only the built copy is stamped.
    assert "<lastmod>" not in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
