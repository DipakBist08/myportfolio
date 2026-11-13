#!/usr/bin/env python3
"""Local preview server for the portfolio.

    python3 tools/serve.py [port]        (npm run serve uses port 4173)

Serves the repository root on 127.0.0.1, like `python3 -m http.server`, and
tells the browser to check every file with the server on every load.

Without that header a browser guesses how long to keep each file from the
file's age, so after an edit it can keep using an old stylesheet or script
next to the new HTML: the page then renders half old, half new.
"""

from __future__ import annotations

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 4173


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
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
