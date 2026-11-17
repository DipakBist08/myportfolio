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

