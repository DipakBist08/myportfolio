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
cp -R index.html 404.html robots.txt sitemap.xml css js assets admin site/
