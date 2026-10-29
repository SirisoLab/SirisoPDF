#!/usr/bin/env python3
"""Opt-in real-JAR smoke test for native startup, web assets, merge, split and shutdown."""

import argparse
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import urllib.request
import uuid
import zipfile

import stirling_native as native


def blank_pdf() -> bytes:
    """Create a valid one-page fixture without adding a PDF-library dependency."""
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>"]
    data = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    start = len(data)
    data.extend(b"xref\n0 4\n0000000000 65535 f \n")
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    data.extend(f"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
    return bytes(data)


def post(opener, origin: str, route: str, files: list[bytes], fields: dict[str, str] | None = None) -> bytes:
    """Send browser-equivalent multipart requests to the actual PDF API."""
    boundary = uuid.uuid4().hex
    body = bytearray()
    for index, data in enumerate(files):
        body.extend((f'--{boundary}\r\nContent-Disposition: form-data; name="fileInput"; filename="fixture-{index}.pdf"\r\n'
                     'Content-Type: application/pdf\r\n\r\n').encode() + data + b"\r\n")
    for key, value in (fields or {}).items():
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
    body.extend(f"--{boundary}--\r\n".encode())
    request = urllib.request.Request(origin + route, data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with opener.open(request, timeout=90) as response:
        return response.read()


def main() -> None:
    """Run only when explicitly requested against a locally built core web JAR."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", type=Path, required=True)
    parser.add_argument("--java", default="java")
    args = parser.parse_args()
    native.verify_web_jar(args.jar)
    with tempfile.TemporaryDirectory(prefix="stirling-pdf-smoke-") as temporary:
        data = Path(temporary)
        ready, shutdown = data / "ready", data / "shutdown"
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        origin = f"http://127.0.0.1:{port}"
        environment = os.environ | native.CORE_ENV | {
            "TAURI_PARENT_PID": str(os.getpid()), "STIRLING_PDF_SHUTDOWN_FILE": str(shutdown),
            "STIRLING_PDF_READY_FILE": str(ready), "STIRLING_BASE_PATH": str(data), "BROWSER_OPEN": "false",
            "LOGGING_LEVEL_ROOT": "WARN", "LOGGING_LEVEL_STIRLING_SOFTWARE_SPDF": "ERROR",
        }
        command = [args.java, "--enable-native-access=ALL-UNNAMED", "-DSTIRLING_PDF_MANAGED_MODE=true", "-jar", str(args.jar.resolve()),
                   "--server.address=127.0.0.1", f"--server.port={port}", "--server.shutdown=graceful"]
        options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
        with (data / "backend.log").open("wb") as log:
            process = subprocess.Popen(command, cwd=data, env=environment, stdout=log, stderr=subprocess.STDOUT, **options)
            try:
                native.wait_ready(process, origin, 180, threading.Event(), ready)
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                with opener.open(origin + "/", timeout=15) as response:
                    html = response.read().decode()
                    assert response.status == 200 and "/assets/" in html, "Bundled React UI missing"
                merged = post(opener, origin, "/api/v1/general/merge-pdfs", [blank_pdf(), blank_pdf()], {"sortType": "orderProvided", "removeCertSign": "true"})
                assert merged.startswith(b"%PDF"), "Merge did not return PDF"
                count = json.loads(post(opener, origin, "/api/v1/analysis/page-count", [merged]))
                assert count["pageCount"] == 2, count
                split = post(opener, origin, "/api/v1/general/split-pages", [merged], {"pageNumbers": "all"})
                with zipfile.ZipFile(io.BytesIO(split)) as archive:
                    members = [name for name in archive.namelist() if name.endswith(".pdf")]
                    assert len(members) == 2, members
                    for name in members:
                        assert json.loads(post(opener, origin, "/api/v1/analysis/page-count", [archive.read(name)]))["pageCount"] == 1
                shutdown.write_text("stop", encoding="utf-8")
                assert process.wait(timeout=40) == 0, "Backend failed during graceful shutdown"
                print(json.dumps({"web_assets": "passed", "merge_2_pages": "passed", "split_2_single_pages": "passed",
                                  "quiet_logging_readiness": "passed", "graceful_shutdown": "passed"}, indent=2))
            except Exception:
                print((data / "backend.log").read_text(encoding="utf-8", errors="replace")[-16000:])
                raise
            finally:
                if process.poll() is None:
                    shutdown.write_text("stop", encoding="utf-8")
                    try:
                        process.wait(timeout=35)
                    except subprocess.TimeoutExpired:
                        native.stop_process(process, 2)


if __name__ == "__main__":
    main()
