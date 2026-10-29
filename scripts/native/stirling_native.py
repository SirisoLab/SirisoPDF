#!/usr/bin/env python3
"""Build and supervise the existing Spring Boot web app without a container.

Python 3.11+ and only its standard library are required. Relative configuration
paths resolve beside the configuration file, or at the repository/package root.
"""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import ipaddress
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile


ROOT = Path(__file__).resolve().parents[2]
BUILD_FLAGS = [
    "-PbuildWithFrontend=true",
    "-PbuildWithPortal=false",
    "-PfrontendMode=core",
]
CORE_ENV = {"STIRLING_FLAVOR": "core", "DISABLE_ADDITIONAL_FEATURES": "true"}


@dataclasses.dataclass(frozen=True)
class Config:
    """Launcher settings; application configuration stays in Stirling's settings.yml."""

    jar: Path
    data_dir: Path
    java: str = "java"
    host: str = "127.0.0.1"
    port: int = 8080
    frontend_port: int = 5173
    startup_timeout: float = 180
    shutdown_timeout: float = 30
    jvm_args: tuple[str, ...] = ("-Xmx2g", "-Djava.awt.headless=true")
    application_args: tuple[str, ...] = ()
    env: dict[str, str] = dataclasses.field(default_factory=dict)


def load_config(path: Path | None) -> Config:
    """Reject misspelled/ill-typed settings before starting any child process."""
    base = path.resolve().parent if path else ROOT
    values = json.loads(path.read_text(encoding="utf-8")) if path else {}
    if not isinstance(values, dict):
        raise ValueError("Configuration must be a JSON object")
    known = {item.name for item in dataclasses.fields(Config)}
    if set(values) - known:
        raise ValueError(f"Unknown configuration keys: {sorted(set(values) - known)}")
    for key, default in (("jar", "dist/native/stirling-pdf.jar"), ("data_dir", ".native-data")):
        value = values.get(key, default)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{key} must be a nonempty path string")
        values[key] = (base / value).resolve()
    for key in ("jvm_args", "application_args"):
        if key in values:
            if not isinstance(values[key], list) or not all(isinstance(v, str) for v in values[key]):
                raise ValueError(f"{key} must be an array of strings")
            values[key] = tuple(values[key])
    environment = values.get("env", {})
    if not isinstance(environment, dict) or not all(
        isinstance(k, str) and isinstance(v, str) and k and "=" not in k and "\0" not in k + v
        for k, v in environment.items()
    ):
        raise ValueError("env must be an object of environment variable strings")
    config = Config(**values)
    if not isinstance(config.java, str) or not config.java:
        raise ValueError("java must be an executable path or command")
    ipaddress.IPv4Address(config.host)
    for key in ("port", "frontend_port"):
        value = getattr(config, key)
        if type(value) is not int or not 1 <= value <= 65535:
            raise ValueError(f"{key} must be an integer between 1 and 65535")
    if config.port == config.frontend_port:
        raise ValueError("port and frontend_port must differ")
    for key in ("startup_timeout", "shutdown_timeout"):
        value = getattr(config, key)
        if type(value) not in (int, float) or not 0 < value <= 3600:
            raise ValueError(f"{key} must be greater than zero and at most 3600 seconds")
    return config


def environment(config: Config) -> dict[str, str]:
    """Force the OSS flavor for this workflow, retaining normal application env overrides."""
    return os.environ | config.env | CORE_ENV | {"STIRLING_BASE_PATH": str(config.data_dir)}


def gradle_command(*args: str) -> list[str]:
    """Use the repository's pinned wrapper on the current operating system."""
    if os.name == "nt":
        return ["cmd.exe", "/d", "/c", str(ROOT / "gradlew.bat"), *args]
    return [str(ROOT / "gradlew"), *args]


def require_tools(*names: str) -> None:
    """Fail with an actionable prerequisite list instead of a partial build."""
    missing = [name for name in names if not shutil.which(name)]
    if missing:
        raise RuntimeError("Missing executable(s) on PATH: " + ", ".join(missing))


def build(config: Config) -> Path:
    """Build the existing backend and core web frontend and stage their single JAR."""
    require_tools(config.java, "node", "npm", "task")
    subprocess.run(
        gradle_command(":stirling-pdf:bootJar", *BUILD_FLAGS, "--no-daemon"),
        cwd=ROOT,
        env=environment(config),
        check=True,
    )
    candidates = [p for p in (ROOT / "app/core/build/libs").glob("*.jar") if not p.name.endswith("-plain.jar")]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one boot JAR, found {len(candidates)}; clean old build artifacts first")
    verify_web_jar(candidates[0])
    config.jar.parent.mkdir(parents=True, exist_ok=True)
    if candidates[0].resolve() != config.jar:
        shutil.copy2(candidates[0], config.jar)
    print(f"Web application: {config.jar}", flush=True)
    return config.jar


def verify_web_jar(jar: Path) -> None:
    """Reject API-only and proprietary JARs instead of silently shipping a different app."""
    with zipfile.ZipFile(jar) as archive:
        names = archive.namelist()
        if "BOOT-INF/classes/static/index.html" not in names or not any(
            name.startswith("BOOT-INF/classes/static/assets/") and name.endswith(".js") for name in names
        ):
            raise ValueError("JAR has no bundled React UI; run the native build first")
        if any(name.startswith("BOOT-INF/lib/proprietary-") or name.startswith("BOOT-INF/lib/saas-") for name in names):
            raise ValueError("Native core workflow requires a core JAR without proprietary/SaaS modules")


@contextlib.contextmanager
def data_lock(directory: Path):
    """Keep one owner of a persistent state directory; OS releases locks after a crash."""
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / ".native-launcher.lock").open("a+b") as handle:
        handle.seek(0)
        handle.write(b"0")
        handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError(f"Another native launcher owns {directory}") from error
        try:
            yield
        finally:
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def check_port(host: str, port: int) -> None:
    """Never attach to or terminate a service that already owns the configured port."""
    with socket.socket() as listener:
        listener.bind((host, port))


def wait_ready(process: subprocess.Popen, url: str, timeout: float, stopping: threading.Event, ready_file: Path | None = None) -> None:
    """Require the app's health JSON; ignore proxies and reject redirects/login HTML."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + timeout
    while not stopping.is_set():
        if process.poll() is not None:
            raise RuntimeError(f"Backend exited before readiness (exit {process.returncode})")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"Backend did not become ready within {timeout} seconds; inspect backend.log")
        if ready_file is not None:
            try:
                if ready_file.read_text(encoding="utf-8").strip() != url.rsplit(":", 1)[1]:
                    raise ValueError("Backend readiness port differs from the configured port")
            except FileNotFoundError:
                stopping.wait(min(0.2, remaining))
                continue
        try:
            with opener.open(url + "/api/v1/info/status", timeout=min(2, remaining)) as response:
                status = json.loads(response.read(65536))
                if response.url == url + "/api/v1/info/status" and response.status == 200 and isinstance(status, dict) and status.get("status") == "UP":
                    if process.poll() is None:
                        return
        except (OSError, ValueError, urllib.error.URLError):
            pass
        stopping.wait(min(0.2, remaining))
    raise InterruptedError("Startup interrupted")


def stop_process(process: subprocess.Popen, timeout: float) -> None:
    """Stop only an owned process tree, allowing graceful POSIX shutdown before escalation."""
    if os.name == "nt":
        if process.poll() is not None:
            return
        try:
            process.send_signal(signal.CTRL_BREAK_EVENT)
            process.wait(timeout=timeout)
            return
        except (OSError, subprocess.TimeoutExpired):
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=False)
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            pass
        # A parent may exit before its conversion workers; the owned group still needs cleanup.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"Could not reap owned child {process.pid}") from error


def stop_backend(process: subprocess.Popen, sentinel: Path, timeout: float) -> None:
    """Reuse Stirling's cross-platform shutdown-file protocol before process-tree fallback."""
    try:
        if process.poll() is None:
            sentinel.write_text("shutdown\n", encoding="utf-8")
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                pass
    finally:
        stop_process(process, min(timeout, 2))
        sentinel.unlink(missing_ok=True)


def supervise(config: Config, development: bool = False) -> int:
    """Own children until Ctrl+C/SIGTERM; a child failure shuts down its peers."""
    require_tools(config.java, *(["node", "npm", "task"] if development else []))
    if not development:
        verify_web_jar(config.jar)
    with data_lock(config.data_dir):
        check_port(config.host, config.port)
        if development:
            check_port(config.host, config.frontend_port)
        stopping = threading.Event()
        previous_handlers = {sig: signal.signal(sig, lambda *_: stopping.set()) for sig in (signal.SIGINT, signal.SIGTERM)}
        processes = []
        sentinel = config.data_dir / f".native-shutdown-{uuid.uuid4().hex}"
        ready_file = config.data_dir / f".native-ready-{uuid.uuid4().hex}"
        try:
            with contextlib.ExitStack() as stack:
                env = environment(config)
                env["SERVER_ADDRESS"] = config.host
                env["SERVER_PORT"] = str(config.port)
                env["SPRING_MAIN_HEADLESS"] = "true"
                env["BROWSER_OPEN"] = "false"
                env["STIRLING_PDF_TAURI_MODE"] = "false"
                env["SPRING_LIFECYCLE_TIMEOUT_PER_SHUTDOWN_PHASE"] = f"{int(config.shutdown_timeout)}s"
                if not development:
                    env["TAURI_PARENT_PID"] = str(os.getpid())
                    env["STIRLING_PDF_SHUTDOWN_FILE"] = str(sentinel)
                    env["STIRLING_PDF_READY_FILE"] = str(ready_file)
                options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
                backend_args = [*config.application_args, f"--server.address={config.host}", f"--server.port={config.port}", "--server.shutdown=graceful"]
                command = gradle_command(":stirling-pdf:bootRun", "-PbuildWithPortal=false", "--args=" + " ".join(backend_args), "--no-daemon") if development else [config.java, *config.jvm_args, "-DSTIRLING_PDF_MANAGED_MODE=true", "-DSTIRLING_PDF_TAURI_MODE=false", "-jar", str(config.jar), *backend_args]
                log = stack.enter_context((config.data_dir / "backend.log").open("ab", buffering=0))
                backend = subprocess.Popen(command, cwd=config.data_dir if not development else ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, **options)
                processes.append(backend)
                probe_host = "127.0.0.1" if config.host == "0.0.0.0" else config.host
                url = f"http://{probe_host}:{config.port}"
                print(f"Starting backend; log: {config.data_dir / 'backend.log'}", flush=True)
                wait_ready(backend, url, config.startup_timeout, stopping, None if development else ready_file)
                if development:
                    frontend_log = stack.enter_context((config.data_dir / "frontend.log").open("ab", buffering=0))
                    frontend_env = env | {"BACKEND_URL": url}
                    frontend = subprocess.Popen(["task", "frontend:dev:core", f"PORT={config.frontend_port}", f"BACKEND_URL={url}"], cwd=ROOT, env=frontend_env, stdout=frontend_log, stderr=subprocess.STDOUT, **options)
                    processes.append(frontend)
                    url = f"http://{probe_host}:{config.frontend_port}"
                print(f"{'Development UI starting' if development else 'Ready'}: {url} (Ctrl+C to stop)", flush=True)
                while not stopping.wait(0.2):
                    for child in processes:
                        if child.poll() is not None:
                            return child.returncode or 1
                return 0
        finally:
            try:
                for child in reversed(processes):
                    if not development:
                        stop_backend(child, sentinel, config.shutdown_timeout)
                    else:
                        stop_process(child, config.shutdown_timeout)
            finally:
                ready_file.unlink(missing_ok=True)
                for sig, handler in previous_handlers.items():
                    signal.signal(sig, handler)


def package(config: Config, output: Path) -> Path:
    """Create a relocatable web bundle; no runtime, native tools or user data are copied."""
    verify_web_jar(config.jar)
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        bundle = Path(temporary) / "stirling-web"
        (bundle / "scripts/native").mkdir(parents=True)
        shutil.copy2(config.jar, bundle / "stirling-pdf.jar")
        for name in ("stirling_native.py", "stirling-native.service"):
            shutil.copy2(ROOT / "scripts/native" / name, bundle / "scripts/native" / name)
        shutil.copy2(ROOT / "LICENSE", bundle / "LICENSE")
        shutil.copy2(ROOT / "docs/NATIVE_WEB.md", bundle / "README.md")
        (bundle / "native.json").write_text(json.dumps({"jar": "stirling-pdf.jar", "data_dir": "data", "env": {"UI_APPNAMENAVBAR": "Siriso PDF"}}, indent=2) + "\n", encoding="utf-8")
        archive = shutil.make_archive(str(output.with_suffix("")), "zip", temporary)
    print(f"Web bundle: {archive}", flush=True)
    return Path(archive)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point; exit nonzero on configuration, readiness or child failures."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("doctor", "build", "run", "dev", "package"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("--jar", type=Path, help="Override the configured JAR path")
    parser.add_argument("--output", type=Path, default=ROOT / "dist/stirling-web.zip")
    args = parser.parse_args(argv)
    try:
        config = load_config(args.config)
        if args.jar:
            config = dataclasses.replace(config, jar=args.jar.resolve())
        if args.command == "doctor":
            require_tools(config.java, "node", "npm", "task")
            subprocess.run([config.java, "-version"], check=True)
            for tool in ("node", "npm", "task"):
                subprocess.run([tool + (".cmd" if os.name == "nt" and tool == "npm" else ""), "--version"], check=True)
            print("Build prerequisites found. Use JDK 25, Node 24 LTS and Task 3; PDF helpers are listed in docs/NATIVE_WEB.md.")
        elif args.command == "build":
            build(config)
        elif args.command == "package":
            package(config, args.output)
        else:
            return supervise(config, args.command == "dev")
        return 0
    except (OSError, ValueError, RuntimeError, TimeoutError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except (KeyboardInterrupt, InterruptedError):
        return 130


if __name__ == "__main__":
    sys.exit(main())
