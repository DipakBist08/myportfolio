#!/usr/bin/env python3
"""Local preview server for the portfolio.

    python3 tools/serve.py [port]        (npm run serve uses port 4173)

Serves the repository root on 127.0.0.1, like `python3 -m http.server`, and
tells the browser to check every file with the server on every load.

Without that header a browser guesses how long to keep each file from the
file's age, so after an edit it can keep using an old stylesheet or script
next to the new HTML: the page then renders half old, half new.

It also sends the headers vercel.json gives each path (all but the caching
ones), so a local preview, and the test suite, run under the live site's
Content-Security-Policy. And like the live site it answers a request for part
of a file (a Range header), which a browser needs to seek in a video.
"""

from __future__ import annotations

import json
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 4173


def vercel_headers(path: str) -> list[tuple[str, str]]:
    """The headers vercel.json sets for `path`. Its sources are written as
    regular expressions ("/(css|js)/(.*)"), which is all this handles."""
    config = json.loads((ROOT / "vercel.json").read_text())
    return [
        (h["key"], h["value"])
        for rule in config.get("headers", [])
        if re.fullmatch(rule["source"], path)
        for h in rule["headers"]
    ]


RANGE = re.compile(r"bytes=(\d*)-(\d*)")


class Handler(SimpleHTTPRequestHandler):
    # The part of the file being sent, as inclusive byte offsets, or None for all of it.
    part: tuple[int, int] | None = None

    def send_head(self):
        """Answers "Range: bytes=a-b" (one range) with 206 Partial Content."""
        self.part = None
        path = self.translate_path(self.path)
        match = RANGE.fullmatch(self.headers.get("Range", "").strip())
        if not match or not (match[1] or match[2]) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        if match[1]:
            start, end = int(match[1]), min(int(match[2]) if match[2] else size - 1, size - 1)
        else:  # "bytes=-n": the last n bytes
            start, end = max(0, size - int(match[2])), size - 1
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.part = (start, end)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", self.date_time_string(os.fstat(f.fileno()).st_mtime))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile) -> None:
        if self.part is None:
            super().copyfile(source, outputfile)
            return
        left = self.part[1] - self.part[0] + 1
        while left > 0:
            chunk = source.read(min(64 * 1024, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def end_headers(self) -> None:
        self.send_header("Accept-Ranges", "bytes")
        for key, value in vercel_headers(urlsplit(self.path).path):
            if key.lower() not in ("cache-control", "pragma"):
                self.send_header(key, value)
        # "no-cache" still lets the browser store the file; it must ask
        # whether its copy is current before using it (a quick 304 if so).
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> int:
    try:
        port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    except ValueError:
        print(f"usage: {Path(sys.argv[0]).name} [port]", file=sys.stderr)
        return 2
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(ROOT)))
    except OSError as err:
        print(f"Could not start on port {port}: {err.strerror or err}. "
              "Is another preview server already running?", file=sys.stderr)
        return 1
    print(f"Serving {ROOT} at http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
