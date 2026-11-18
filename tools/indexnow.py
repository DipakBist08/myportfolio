"""Tell IndexNow search engines (Bing, Yandex, Naver, Seznam and others) that
portfolio pages were added or changed. Google does not use IndexNow; for
Google, use "Request indexing" in Search Console.

    python3 tools/indexnow.py https://dipakbist.com.np/
        Dry run: prints the request it would send. Nothing leaves your machine.

    python3 tools/indexnow.py --send https://dipakbist.com.np/
        Sends it. Run this only after the change is live (after the deploy).

The key is public by design: search engines check that
https://dipakbist.com.np/<key>.txt (the file at the repository root, which
scripts/build-site.sh publishes) contains it. The blog has its own key and
script (blog/scripts/indexnow.mjs).
Protocol: https://www.indexnow.org/documentation
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

KEY = "9eaf3135fd580d4d3a86cbd84bcf91df"
HOST = "dipakbist.com.np"
ENDPOINT = "https://api.indexnow.org/indexnow"
MEANING = {
    200: "OK: the URLs were received.",
    202: "Accepted: the URLs were received; the key is still being checked.",
    400: "Bad request: the request format is invalid.",
    403: "Forbidden: the key was not found or does not match the key file.",
    422: "Unprocessable: a URL does not belong to the host, or the key does not match.",
    429: "Too many requests: wait before sending again.",
}


def main(argv: list[str]) -> int:
    send = "--send" in argv
    urls = [a for a in argv if a != "--send"]
    if not urls:
        print("Give one or more full URLs, for example:\n  python3 tools/indexnow.py https://dipakbist.com.np/", file=sys.stderr)
        return 1
    wrong = [u for u in urls if urlparse(u).scheme != "https" or urlparse(u).hostname != HOST]
    if wrong:
        print(f"These are not https://{HOST}/ URLs:\n  " + "\n  ".join(wrong), file=sys.stderr)
        return 1
    body = {"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls}
    if not send:
        print(f"Dry run. This would be sent to {ENDPOINT}:\n{json.dumps(body, indent=2)}")
        print("\nAdd --send to send it (only after the pages are live).")
        return 0
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.status
    except urllib.error.HTTPError as e:
        status = e.code
    print(f"{status} {MEANING.get(status, '')}")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
