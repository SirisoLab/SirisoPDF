"""Exercise configuration, packaging and real owned-process lifecycle boundaries."""

import dataclasses
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import zipfile


SCRIPT = Path(__file__).resolve().parents[1] / "stirling_native.py"
spec = importlib.util.spec_from_file_location("stirling_native", SCRIPT)
native = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = native
spec.loader.exec_module(native)


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


class NativeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.jar = self.directory / "test.jar"
        with zipfile.ZipFile(self.jar, "w") as archive:
            archive.writestr("BOOT-INF/classes/static/index.html", "<html></html>")
            archive.writestr("BOOT-INF/classes/static/assets/index.js", "export {}")
        self.config = native.Config(self.jar, self.directory / "data", java=sys.executable, port=free_port(), shutdown_timeout=1)

    def load(self, value):
        path = self.directory / "native.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return native.load_config(path)

    def test_configuration_paths_are_relative_to_configuration_file(self):
        loaded = self.load({"jar": "app.jar", "data_dir": "state", "jvm_args": ["-Xmx1g"]})
        self.assertEqual(loaded.jar, self.directory / "app.jar")
        self.assertEqual(loaded.data_dir, self.directory / "state")
        self.assertEqual(loaded.jvm_args, ("-Xmx1g",))

    def test_configuration_rejects_mistakes_before_launch(self):
        for invalid in ({"prot": 1}, {"port": True}, {"port": 0}, {"startup_timeout": 0}, {"env": {"A": 2}}, {"env": {"A=B": "x"}}, {"jvm_args": "-Xmx2g"}, {"host": "example.com"}, []):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.load(invalid)

    def test_existing_environment_cannot_accidentally_select_proprietary_build(self):
        config = dataclasses.replace(self.config, env={"STIRLING_FLAVOR": "saas", "CUSTOM": "retained"})
        environment = native.environment(config)
        self.assertEqual(environment["STIRLING_FLAVOR"], "core")
        self.assertEqual(environment["DISABLE_ADDITIONAL_FEATURES"], "true")
        self.assertEqual(environment["CUSTOM"], "retained")
        self.assertEqual(environment["STIRLING_BASE_PATH"], str(config.data_dir))

    def test_rejects_missing_frontend_or_proprietary_modules(self):
        native.verify_web_jar(self.jar)
        with zipfile.ZipFile(self.jar, "a") as archive:
            archive.writestr("BOOT-INF/lib/proprietary-1.0.jar", "")
        with self.assertRaisesRegex(ValueError, "core JAR"):
            native.verify_web_jar(self.jar)
        with zipfile.ZipFile(self.jar, "w") as archive:
            archive.writestr("BOOT-INF/classes/static/index.html", "API only")
        with self.assertRaisesRegex(ValueError, "React UI"):
            native.verify_web_jar(self.jar)

    def test_data_lock_is_exclusive_and_reusable(self):
        with native.data_lock(self.config.data_dir):
            with self.assertRaisesRegex(RuntimeError, "Another native launcher"):
                with native.data_lock(self.config.data_dir):
                    self.fail("Lock allowed a second owner")
        with native.data_lock(self.config.data_dir):
            pass

    def test_port_conflict_preserves_existing_listener(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            with self.assertRaises(OSError):
                native.check_port("127.0.0.1", listener.getsockname()[1])
            self.assertGreater(listener.fileno(), 0)

    def spawn_fake(self, status="UP"):
        options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("fake_backend.py")), str(self.config.port)], env=os.environ | {"FAKE_STATUS": status}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **options)
        self.addCleanup(native.stop_process, process, 1)
        return process

    def test_real_health_readiness_and_owned_process_shutdown(self):
        process = self.spawn_fake()
        native.wait_ready(process, f"http://127.0.0.1:{self.config.port}", 10, threading.Event())
        native.stop_process(process, 1)
        self.assertIsNotNone(process.poll())

    def test_readiness_rejects_an_unhealthy_service_and_can_be_cancelled(self):
        process = self.spawn_fake("DOWN")
        with self.assertRaises(TimeoutError):
            native.wait_ready(process, f"http://127.0.0.1:{self.config.port}", 0.15, threading.Event())
        stopping = threading.Event()
        stopping.set()
        with self.assertRaises(InterruptedError):
            native.wait_ready(process, f"http://127.0.0.1:{self.config.port}", 10, stopping)

    def test_supervisor_cleans_up_after_readiness_failure(self):
        real_popen = subprocess.Popen
        children = []

        def start_fake(*_args, **kwargs):
            process = real_popen([sys.executable, str(Path(__file__).with_name("fake_backend.py")), str(self.config.port)], **kwargs)
            children.append(process)
            return process

        with patch.object(native.subprocess, "Popen", side_effect=start_fake), patch.object(native, "wait_ready", side_effect=TimeoutError("test startup failure")):
            with self.assertRaises(TimeoutError):
                native.supervise(self.config)
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())

    def test_supervisor_uses_existing_backend_graceful_shutdown_protocol(self):
        real_popen = subprocess.Popen
        real_ready = native.wait_ready
        launches = []
        marker = self.directory / "stopped.txt"
        config = dataclasses.replace(self.config, env={"FAKE_STOPPED_FILE": str(marker)})

        def start_fake(command, **kwargs):
            self.assertIn("-DSTIRLING_PDF_MANAGED_MODE=true", command)
            self.assertNotIn("-DSTIRLING_PDF_TAURI_MODE=true", command)
            self.assertEqual(kwargs["env"]["TAURI_PARENT_PID"], str(os.getpid()))
            self.assertFalse(Path(kwargs["env"]["STIRLING_PDF_SHUTDOWN_FILE"]).exists())
            launches.append(kwargs["env"]["STIRLING_PDF_SHUTDOWN_FILE"])
            return real_popen([sys.executable, str(Path(__file__).with_name("fake_backend.py")), str(config.port)], **kwargs)

        def ready_then_stop(process, url, timeout, stopping, ready_file):
            real_ready(process, url, timeout, stopping, ready_file)
            stopping.set()

        with patch.object(native.subprocess, "Popen", side_effect=start_fake), patch.object(native, "wait_ready", side_effect=ready_then_stop):
            self.assertEqual(native.supervise(config), 0)
        self.assertEqual(marker.read_text(encoding="utf-8"), "graceful")
        self.assertFalse(Path(launches[0]).exists())

    def test_owned_readiness_requires_matching_published_port(self):
        process = self.spawn_fake()
        ready = self.directory / "ready"
        with self.assertRaises(TimeoutError):
            native.wait_ready(process, f"http://127.0.0.1:{self.config.port}", 0.1, threading.Event(), ready)
        ready.write_text("1\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "differs"):
            native.wait_ready(process, f"http://127.0.0.1:{self.config.port}", 10, threading.Event(), ready)

    def test_build_uses_bundled_core_frontend_flags(self):
        libraries = self.directory / "app/core/build/libs"
        libraries.mkdir(parents=True)
        source = libraries / "stirling.jar"
        source.write_bytes(self.jar.read_bytes())
        staged = self.directory / "dist/native/stirling-pdf.jar"
        with patch.object(native, "ROOT", self.directory), patch.object(native, "require_tools"), patch.object(native.subprocess, "run") as run:
            native.build(dataclasses.replace(self.config, jar=staged))
        command = run.call_args.args[0]
        self.assertIn(":stirling-pdf:bootJar", command)
        for flag in native.BUILD_FLAGS:
            self.assertIn(flag, command)
        self.assertEqual(staged.read_bytes(), source.read_bytes())

    def test_package_is_relocatable_and_does_not_copy_user_data(self):
        self.config.data_dir.mkdir()
        (self.config.data_dir / "secret.txt").write_text("private")
        output = native.package(self.config, self.directory / "web.zip")
        with zipfile.ZipFile(output) as archive:
            names = archive.namelist()
            self.assertIn("stirling-web/stirling-pdf.jar", names)
            self.assertIn("stirling-web/LICENSE", names)
            self.assertIn("stirling-web/scripts/native/stirling_native.py", names)
            self.assertFalse(any("secret" in name for name in names))
            settings = json.loads(archive.read("stirling-web/native.json"))
            self.assertEqual(settings["jar"], "stirling-pdf.jar")
            self.assertEqual(settings["data_dir"], "data")


if __name__ == "__main__":
    unittest.main()
