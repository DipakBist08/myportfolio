#!/bin/sh
# Copy the portfolio's public files into site/, the only folder that is
# served: vercel.json's "outputDirectory" and the GitHub Pages workflow both
# publish site/, never the repository root. The repository also holds the
# blog, the CMS, tests and tooling, and none of that belongs on the site.
#
# To publish a new top-level file or folder, add it to the list below.
# tests/test_deploy.py runs this script and checks the result.
set -eu
cd "$(dirname "$0")/.."
rm -rf site
mkdir site
cp -R index.html 404.html favicon.ico robots.txt sitemap.xml css js assets admin site/

# The homepage's <lastmod> in the published sitemap: the date of the last
# commit that changed index.html, or today's date where the build has no git
# history. The sitemap.xml in the repository stays undated.
LASTMOD=$(git log -1 --format=%cs -- index.html 2>/dev/null || true)
[ -n "$LASTMOD" ] || LASTMOD=$(date -u +%Y-%m-%d)
awk -v d="$LASTMOD" '
    { print }
    /<loc>https:\/\/dipakbist\.com\.np\/<\/loc>/ {
        match($0, /^ */)
        printf "%s<lastmod>%s</lastmod>\n", substr($0, 1, RLENGTH), d
    }' sitemap.xml > site/sitemap.xml
