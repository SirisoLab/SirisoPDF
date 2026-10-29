# Native web application (without Docker)

Stirling-PDF already has a Spring Boot server and a React web interface. This
workflow builds those same components into one executable JAR and runs them
directly on the host. Docker is optional; the Java backend remains required.
CEF is a browser shell for that local application, not a replacement PDF engine.
Removing the backend would require rewriting Java PDF processing, native-tool
integration, APIs and security, and would lose functionality.

This workflow intentionally selects the **core** backend and **core web**
frontend. It leaves the existing Docker, proprietary, SaaS and Tauri workflows
available. It does not port licensed desktop/Tauri integrations into CEF.

## Prerequisites

For builds/development install Python 3.11+, JDK 25, Node.js 24 LTS with npm,
and Task 3 on PATH. Gradle uses the committed wrapper. Initial builds download
Gradle, Maven and npm dependencies and require network access. For a built web
bundle only Python and a compatible Java 25 runtime are required for the base
application; Node, npm, Task and Gradle are not runtime requirements.

```sh
task native:doctor
task native:build
task native:run
```

On systems where Python is `python3`, add `PYTHON=python3` to Task commands.
Direct equivalents are `python scripts/native/stirling_native.py doctor`,
`build`, `run`, `dev`, and `package`. All commands work from the repository root
on Windows, Linux and macOS. Native helpers have separate platform requirements.

The build invokes the existing supported Gradle/Task frontend pipeline:

```sh
STIRLING_FLAVOR=core DISABLE_ADDITIONAL_FEATURES=true ./gradlew :stirling-pdf:bootJar -PbuildWithFrontend=true -PbuildWithPortal=false -PfrontendMode=core --no-daemon
```

The cross-platform Python command sets those environment variables itself,
including on Windows. It stages `dist/native/stirling-pdf.jar`, checks for a
bundled React UI, and rejects proprietary/SaaS backend modules. A backend-only
JAR would show the API landing page instead of the full PDF editor.

## Development

```sh
task native:dev
```

The supervisor starts core `:stirling-pdf:bootRun`, waits for
`/api/v1/info/status` to report `UP`, then starts the existing
`frontend:dev:core` task with a proxy to the backend. Open
`http://127.0.0.1:5173`; Vite provides frontend hot reload. The production command
serves both the API and the bundled UI on `http://127.0.0.1:8080`.
Development logs are `backend.log` and `frontend.log` under the data directory.
Backend JVM options for Gradle development use the existing Gradle/JAVA_HOME
configuration; `jvm_args` applies to production `run`.
Gradle development keeps the repository as its working directory, so an H2
datasource using a relative path resolves there. Set `SPRING_DATASOURCE_URL` in
the launcher `env` to select a separate development database explicitly.

Use Ctrl+C to stop. A startup timeout, backend failure or frontend failure stops
the supervisor's children and produces a nonzero exit. Occupied ports fail
before launch. The launcher never attaches to an existing server. A file lock
prevents two native launchers from sharing a data directory and releases on
process exit, including a crash. Do not point another launch mechanism or a CEF
instance at that same directory while the native launcher runs.

Production shutdown reuses the existing backend process monitor: a unique
per-launch shutdown file asks Spring to close gracefully on every OS. The
backend also watches the supervisor PID and exits if its parent crashes. No
Tauri frontend or Tauri runtime is used; the monitor retains its existing
class name for compatibility. It is enabled with `STIRLING_PDF_MANAGED_MODE`,
which preserves normal web routing, CORS and PDF pipelines rather than selecting
Tauri desktop behavior. The parent PID environment variable keeps the existing
`TAURI_PARENT_PID` name for compatibility. The launcher waits up to
`shutdown_timeout`, then stops the owned process tree if necessary.
On Linux/macOS, fallback sends SIGTERM and then SIGKILL to its owned process
group. On Windows fallback sends CTRL_BREAK followed by
`taskkill /PID ... /T /F`. Forced termination can interrupt conversions.
Development uses Gradle process supervision rather than the shutdown-file
protocol; Windows development shutdown may need the forced fallback because
the JVM can treat CTRL_BREAK as a thread dump.

## Configuration and persistent data

```sh
task native:run -- --config scripts/native/native.example.json
task native:run -- --jar /absolute/path/to/core-web.jar
```

Copy `scripts/native/native.example.json` and adjust paths. Relative paths are
resolved beside that JSON file. With no file, paths are relative to the
repository root: `dist/native/stirling-pdf.jar` and `.native-data`. Keep local
configuration containing secrets out of source control.

The JSON accepts `jar`, `data_dir`, `java`, IPv4 `host`, `port`, `frontend_port`,
`startup_timeout`, `shutdown_timeout` (seconds), `jvm_args`, `application_args`
and string-valued `env`. Unknown keys and invalid values fail before launching.
`STIRLING_FLAVOR=core` and `DISABLE_ADDITIONAL_FEATURES=true` are fixed for this
workflow. Set a Java executable path in `java` for production, and set JAVA_HOME
normally for the Gradle build/development wrapper. Argument arrays avoid shell
interpolation for the JAR. Gradle development serializes application arguments
for `bootRun`; avoid arguments containing spaces there and put application
settings in `env` or `custom_settings.yml` instead.

Production readiness first requires a unique per-launch ready file, atomically
published by the backend at ApplicationReadyEvent with the actual listening
port, then checks its health JSON. This ownership handshake does not depend on
log verbosity and prevents a port-race winner being mistaken for the child app.
An older unmodified JAR without this monitor extension will time out in native
`run`; rebuild from this checkout before packaging.

The launcher sets `STIRLING_BASE_PATH` to `data_dir`; existing application code
stores `configs/`, `logs/`, `pipeline/`, `customFiles/` and related settings
there. It also runs the production JVM in that directory so relative storage
paths stay there. Back up the entire data directory. The launcher logs append
to `backend.log`; configure host log rotation for long-running deployments.
Stirling settings remain in `data_dir/configs/settings.yml` and
`custom_settings.yml`, with normal environment overrides. The launcher supports
the root URL context path; use a reverse proxy when exposing a different public
URL prefix. Application arguments that change the context path or replace the
configured listener will cause readiness to fail.

Default bind is loopback. A core build excludes proprietary authentication and
administration features: protect any remote deployment with an authenticating
TLS reverse proxy, and retain a loopback backend. Explicitly setting
`host` to `0.0.0.0` exposes the API to other machines. Authentication features in
other flavors require their own licensing and build review.

## PDF functionality and external tools

The PDF controllers, PDFBox operations, client PDF rendering and file workflow
are unchanged. Native launch does not uninstall or replace any PDF feature.
However, Docker's base image supplies tools/fonts/models that a host does not
automatically have. **Feature parity requires provisioning the matching native
dependencies on each target OS.** The launcher does not silently install them.

Consult `docker/base/Dockerfile`, application configuration and the existing
native installation documentation when choosing supported versions:

| Capability | Host dependencies to provision when used |
| --- | --- |
| OCR | OCRmyPDF, Tesseract and requested language data, Ghostscript, unpaper |
| PDF/image conversions and compression | Ghostscript, QPDF, ImageMagick, Poppler as required by each operation |
| Office conversions | Appropriate configured Java conversion/native dependencies or LibreOffice/unoserver; Docker's sandbox wrapper and hardening are not provided by this launcher |
| HTML/e-book conversion | WeasyPrint, Calibre and their runtime libraries when used |
| Consistent rendering | Fontconfig/system fonts and application fonts appropriate to the OS |
| Model-backed tools | Compatible native libraries and model weights; Docker's preinstalled model layer is not copied |

Put tools on the service account's PATH and configure their existing application
path settings. Python-based OCR/conversion tools may need their own virtual
environment; add its executable directory to PATH. The AI engine is a separate
optional service and is not started by the core workflow. Windows/macOS tool
availability and Linux-only sandbox behavior differ. Test the operations you
deploy; building a JAR does not prove external tool parity.

## Packaging and Linux service deployment

```sh
task native:package
```

This packages the staged JAR, native runner, sample systemd unit, license and
this document into `dist/stirling-web.zip`. It does not build first and fails
if the JAR is missing or lacks the bundled UI. It copies no user data, secrets,
native helpers or Java runtime. In the extracted `stirling-web` directory run:

```sh
python scripts/native/stirling_native.py run --config native.json
```

For Linux deployment, install a compatible Java runtime and Python 3.11+, unpack
the bundle at `/opt/stirling-web`, create a dedicated `stirling-pdf` system
user/group, and create `/var/lib/stirling-pdf` writable by that user. Put this
configuration in `/etc/stirling-pdf/native.json`, readable by the service user:

```json
{
  "jar": "/opt/stirling-web/stirling-pdf.jar",
  "data_dir": "/var/lib/stirling-pdf",
  "java": "/usr/bin/java",
  "host": "127.0.0.1",
  "port": 8080,
  "shutdown_timeout": 30
}
```

Review and copy `scripts/native/stirling-native.service` to
`/etc/systemd/system/`, then use the normal `systemctl daemon-reload` and
`systemctl enable --now stirling-native` administration steps. Installing a
system service requires administrator access and is deliberately not performed
by the packaging script. The supplied unit keeps application code read-only,
allows writes to the state directory, stops the supervisor gracefully, and lets
systemd kill remaining service processes after 75 seconds. Adjust PATH for
optional tools and filesystem restrictions for custom storage/Office conversion.
Place a TLS/authenticating reverse proxy in front of loopback for remote access.

Upgrade by stopping the service, backing up data, replacing the code bundle and
restarting. Keep the external data directory and configuration. Inspect
`journalctl -u stirling-native` and `backend.log` if readiness fails. Do not
change Java or dependency versions merely to work around an unexplained build
failure: use the repository-pinned toolchain.

## Licensing and validation

The root MIT license has explicit exceptions for proprietary, SaaS, engine,
processor and existing desktop frontend directories. The new workflow defaults
to core web sources and does not copy those desktop integrations. It does not
change or grant rights to any existing excluded source or third-party library.
Review bundled third-party notices/licenses and run the repository's license
report/check tasks before redistribution. The package includes the root license;
this is not a complete third-party license compliance report. CEF/Chromium and
JCEF distributions need their own notices and platform license review.

Run `task native:check` for configuration, core build command, JAR shape,
exclusive data locking, occupied ports, HTTP readiness, failure cleanup, real
owned child termination and relocatable packaging checks. These tests require
only Python and do not pretend to exercise real PDF operations. For full
validation also build and launch the real core JAR and exercise PDF workflows
and each installed external converter on every deployment platform.

`task native:smoke` performs an opt-in check against `dist/native/stirling-pdf.jar`:
it starts the real backend, checks the bundled web assets, merges two blank PDF
pages, verifies their page count, splits them into two one-page PDFs, and requests
graceful shutdown. It also verifies readiness with INFO logging suppressed.
It does not test OCR, Office conversion or the CEF graphical interface.
