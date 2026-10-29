# CEF desktop launcher

This is a separate Java/Swing launcher embedding **Chromium Embedded Framework**
through JCEF/JCEFMaven. It displays the existing core **web** UI served by the
existing local Spring Boot backend. It does not use the separately licensed
Tauri desktop layer. PDF code and API contracts are unchanged.

## Build

Install JDK 25, Node 24 LTS, Task 3 and the native PDF tools described in
[`docs/NATIVE_WEB.md`](../../docs/NATIVE_WEB.md). From the repository root:

```text
task native:build
task cef:check
task cef:package
```

Or use the pinned Gradle wrapper directly (Windows: `gradlew.bat`):

```sh
./gradlew -p desktop/cef checkLauncher
./gradlew -p desktop/cef packageDesktop -PbackendJar=/absolute/path/to/dist/native/stirling-pdf.jar
```

The standalone Gradle project avoids adding desktop dependencies to the PDF
backend. `packageDesktop` produces `desktop/cef/build/distributions/siriso-pdf-cef.zip`.
It includes application libraries, the backend JAR, the matching native CEF JAR,
launch scripts and dependency license metadata. Build on the target OS/CPU;
`-PcefPlatform=windows-amd64` (or linux-amd64, linux-arm64, macosx-amd64,
macosx-arm64) selects native artifacts explicitly but does not cross-build an
installer. Unsupported artifact names fail dependency resolution.

Extract the archive, optionally copy `launcher.properties.example` to
`launcher.properties`, then start `bin/siriso-pdf-cef` or `bin/siriso-pdf-cef.bat`.
The scripts require a Java 25 runtime (`JAVA_HOME` or PATH). Pass an absolute
properties-file path as the first argument for another installation/config.
Backslashes in Java properties must be escaped, or use forward slashes.

CEF native libraries are extracted **from the packaged classpath** into the
versioned user-data directory on first start. Network fallback mirrors are
disabled. No CEF download is needed at launch. JCEF native OS libraries still
need to be available (Linux GTK/NSS/X11 and a graphical session, Windows VC++
runtime where required). Native code loading must be permitted. A bundled JRE,
signed installers, notarization and auto-update are not included.

## Configuration and lifetime

`backendJar`, `javaExecutable`, `dataDir`, `port`, `startupTimeoutSeconds` and
`shutdownTimeoutSeconds` can be set in the properties file. Paths resolve beside
that file. Default user data lives in LOCALAPPDATA on Windows, Application
Support on macOS, and XDG_DATA_HOME (or ~/.local/share) on Linux. The backend
working directory also points there, keeping relative H2 and configuration
paths out of the install directory. Environment variables and Stirling's
`configs/settings.yml` retain their ordinary meaning.

The launcher locks its data directory, rejects an occupied port, and starts its
own JVM on **127.0.0.1:8780**. A stable port preserves browser-origin IndexedDB
data between launches. It waits for the owned backend's unique readiness file
and `/api/v1/info/status` JSON before opening CEF, independently of logging levels.
This health response establishes
application readiness, not whether every converter is installed.

On close, a unique shutdown file requests Spring graceful shutdown. The existing
`TauriProcessMonitor` is activated through `STIRLING_PDF_MANAGED_MODE`, retaining
its parent/sentinel environment names; no Tauri application mode is enabled.
The frontend remains a web build. It also detects a dead
launcher parent. After the configurable grace period the launcher terminates
only its owned backend and captured descendants. A JVM shutdown hook handles
ordinary termination. As with other process supervisors, OS kill/power failure
can interrupt active PDF jobs. `backend.log` is replaced each launch; normal
application logs remain in the data directory.

There is no JavaScript-to-Java bridge. Top-level navigation stays at the owned
loopback origin, popups are blocked, and downloads use CEF's native Save dialog.
PDF uploads use the browser file picker. External links/SSO popups are not a
supported desktop workflow here; the ordinary web deployment remains available.
Loopback is a binding restriction, not authentication against other local users.

## Verification and limits

`task cef:check` compiles against the actual pinned JCEF API, checks formatting,
and runs tests for config paths, navigation, occupied ports, failed startup,
real child-JVM readiness, idempotent shutdown and sentinel cleanup. Child-process
tests use a small HTTP fixture; they do **not** validate real PDF processing or
CEF rendering. See the delivered validation report for checks actually run.

`task native:smoke` performs an opt-in check of the real built backend: bundled
web assets, merging two pages, splitting them back into single-page PDFs,
readiness with quiet logging and graceful shutdown. It uses temporary local
fixtures and starts no GUI. `packageDesktop` also verifies extraction of the
packaged CEF native bundle with network mirrors disabled.

Release acceptance still requires a graphical run on each target OS: upload a
PDF, merge/split it, download the result, reopen the app to check persistence,
exercise file dialogs/printing and test installed OCR/converters with sample
documents. Keep Chromium/CEF updated and review the included notices before
redistribution. Missing external PDF tools retain upstream feature-disable
behavior; the launcher cannot supply their functionality by itself.
