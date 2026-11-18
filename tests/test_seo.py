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
# His profiles, exactly as he gave them (18/11/2026). LinkedIn and GitHub first:
# they carry the most professional weight.
PROFILES = (
    "https://www.linkedin.com/in/dipakbist/",
    "https://github.com/DipakBist08",
    "https://www.facebook.com/dipak.beesta",
    "https://www.instagram.com/dipak.beest/",
    "https://x.com/Deepak_B_08",
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
    # The brief's skills (Part 13), and the employer the page already names.
    for skill in ("Software Testing", "Quality Assurance", "Manual Testing", "Test Automation", "Playwright",
                  "Python", "Pytest", "Selenium", "API Testing", "Postman", "AI-Assisted QA", "Performance Testing"):
        assert skill in person["knowsAbout"], skill
    assert person["worksFor"] == {"@type": "Organization", "name": "Sterling Wells"}
    # His real portrait, published under a name that says who it is.
    image = person["image"]
    assert image == "https://dipakbist.com.np/assets/dipak-bist-software-qa-engineer.webp"
    assert (ROOT / image.removeprefix("https://dipakbist.com.np/")).is_file()


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


def test_title_and_description_fit_a_search_result():
    """The brief's title, and a description short enough that Google shows all of it."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    assert title == "Dipak Bist | Software QA Engineer in Nepal"
    p = page()
    meta = {m.get("name") or m.get("property"): m.get("content") for m in p.meta}
    assert 120 <= len(meta["description"]) <= 160, len(meta["description"])
    assert meta["description"].startswith("Software QA Engineer with 4+ years")
    assert meta["og:title"] == meta["twitter:title"] == title
    assert meta["og:description"] == meta["twitter:description"]


def test_every_profile_is_linked_in_the_footer_and_contact_section():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    footer = html[html.index('<ul class="footer__social"'):]
    footer = footer[: footer.index("</ul>")]
    contact = html[html.index('id="contact"'):html.index('<form id="contact-form"')]
    for url in PROFILES:
        assert f'href="{url}"' in footer, f"footer lacks {url}"
        assert f'href="{url}"' in contact, f"contact section lacks {url}"
    assert graph()[0]["sameAs"] == list(PROFILES)
    # An old form of a profile URL must not linger next to the exact one.
    assert 'href="https://www.linkedin.com/in/dipakbist"' not in html


def test_x_cards_name_his_account():
    p = page()
    tags = {m.get("name"): m.get("content") for m in p.meta if m.get("name", "").startswith("twitter:")}
    assert tags["twitter:site"] == tags["twitter:creator"] == "@Deepak_B_08"


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

    keyfile = re.search(r'^KEY = "(\w+)"$', (ROOT / "tools" / "indexnow.py").read_text(encoding="utf-8"), re.M).group(1) + ".txt"
    for name in ("index.html", "404.html", "robots.txt", "sitemap.xml", "favicon.ico", keyfile, "scripts/build-site.sh"):
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, tmp_path / name)
    for folder in ("css", "js", "assets", "admin"):
        shutil.copytree(ROOT / folder, tmp_path / folder)
    subprocess.run(["sh", "scripts/build-site.sh"], cwd=tmp_path, check=True)
    xml = (tmp_path / "site" / "sitemap.xml").read_text(encoding="utf-8")
    entry = re.search(r"<loc>https://dipakbist\.com\.np/</loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>", xml)
    assert entry, "the homepage entry carries a <lastmod> date"
    # The footer's "Last updated" shows that same date, in DD/MM/YYYY.
    y, m, d = entry.group(1).split("-")
    built = (tmp_path / "site" / "index.html").read_text(encoding="utf-8")
    assert f'<time class="site-updated" datetime="{entry.group(1)}">{d}/{m}/{y}</time>' in built
    # The source file is left alone; only the built copy is stamped.
    assert "<lastmod>" not in (ROOT / "sitemap.xml").read_text(encoding="utf-8")


def test_sitemap_lists_only_this_sites_pages():
    """Separate sites, separate sitemaps: the blog lists its own URLs."""
    import xml.etree.ElementTree as ET

    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ET.parse(ROOT / "sitemap.xml").getroot()
    locs = [e.text.strip() for e in root.findall("s:url/s:loc", ns)]
    assert locs == ["https://dipakbist.com.np/"]


def test_robots_txt_lets_crawlers_in_and_names_the_sitemap():
    lines = [l.strip() for l in (ROOT / "robots.txt").read_text(encoding="utf-8").splitlines()
             if l.strip() and not l.startswith("#")]
    assert lines == ["User-agent: *", "Allow: /", "Sitemap: https://dipakbist.com.np/sitemap.xml"]
    # /admin stays out of the index through its response header, not robots.txt.
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    admin = next(h for h in config["headers"] if h["source"] == "/admin/(.*)")
    assert {"key": "X-Robots-Tag", "value": "noindex, nofollow, noarchive"} in admin["headers"]


def test_blog_cards_use_each_posts_current_title():
    """The cards' link text is the post's own title, so both sites say the same thing."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    cards = re.findall(
        r'<h3 class="post__title"><a href="https://blog\.dipakbist\.com\.np/blog/([^"]+)"[^>]*>(.*?)</a></h3>', html)
    assert len(cards) == 3
    for slug, text in cards:
        mdx = (ROOT / "blog" / "content" / "blog" / f"{slug}.mdx").read_text(encoding="utf-8")
        title = re.search(r'^title: "(.*)"$', mdx, re.M).group(1)
        assert text == title, slug


def test_indexnow_key_file_matches_the_script():
    """Bing and others check https://dipakbist.com.np/<key>.txt before they accept a notice."""
    script = (ROOT / "tools" / "indexnow.py").read_text(encoding="utf-8")
    key = re.search(r'^KEY = "([0-9a-f]{32})"$', script, re.M).group(1)
    assert (ROOT / f"{key}.txt").read_text(encoding="utf-8") == key
