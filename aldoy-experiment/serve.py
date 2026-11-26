"""Local preview server for the AlDoy Athlete Hub site.

Python's built-in `http.server` does not support HTTP Range requests, which
means browsers cannot seek inside the scroll-scrubbed hero video. This tiny
server adds Range support so the story behaves exactly as it does on Vercel.

    python serve.py            # http://localhost:8123
    python serve.py 8000       # custom port
"""

import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CHUNK = 64 * 1024


class RangeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().do_GET()
        if not os.path.isfile(path):
            return super().do_GET()

        size = os.path.getsize(path)
        range_header = self.headers.get("Range")
        if not range_header:
            return super().do_GET()

        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not match:
            return super().do_GET()

        start_raw, end_raw = match.groups()
        if start_raw:
            start = int(start_raw)
            end = int(end_raw) if end_raw else size - 1
        else:
            length = int(end_raw or 0)
            start = max(0, size - length)
            end = size - 1
        start = max(0, min(start, size - 1))
        end = max(start, min(end, size - 1))
        length = end - start + 1

        ctype = self.guess_type(path)
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        with open(path, "rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(CHUNK, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    def end_headers(self):
        if self.path.endswith((".mp4", ".webm", ".woff2")):
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), RangeHandler)
    print(f"AlDoy preview → http://localhost:{port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
