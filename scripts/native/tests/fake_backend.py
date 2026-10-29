"""A real child HTTP service for launcher lifecycle tests; performs no PDF operations."""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import signal
import sys


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": os.environ.get("FAKE_STATUS", "UP")}).encode())

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, lambda *_: sys.exit(0))
    with HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler) as server:
        ready = os.environ.get("STIRLING_PDF_READY_FILE")
        if ready:
            Path(ready).write_text(sys.argv[1] + "\n", encoding="utf-8")
        sentinel = os.environ.get("STIRLING_PDF_SHUTDOWN_FILE")
        if sentinel:
            server.timeout = 0.05
            while not Path(sentinel).exists():
                server.handle_request()
            marker = os.environ.get("FAKE_STOPPED_FILE")
            if marker:
                Path(marker).write_text("graceful", encoding="utf-8")
        else:
            server.serve_forever()
