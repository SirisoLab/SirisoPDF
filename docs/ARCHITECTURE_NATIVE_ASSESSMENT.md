# Native web and CEF assessment

Assessment baseline: upstream commit `684608d143779bf3a8ffc67639f077a1202c62ff`, inspected on 2026-10-26. Findings below are source observations unless labelled as a design decision or an unverified runtime property. The requested REA skill routes complete source-repository analysis to ordinary repository tools; no binary decompilation or REA provider setup was necessary.

## Architecture and the requested change

Stirling-PDF is already a web application. Its Java Spring Boot backend runs an embedded Jetty HTTP server, supplies REST PDF operations, and can serve the compiled React UI from the same executable JAR. The frontend uses Vite, React and TypeScript. The upstream repository already supplies native Gradle `bootRun` tasks and a separate Tauri desktop wrapper. Docker is one packaging/dependency-provisioning option, not an architectural prerequisite. Evidence: [backend build](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/build.gradle), [backend tasks](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/.taskfiles/backend.yml), [frontend build and proxy](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/frontend/vite.config.ts), [Tauri configuration](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/frontend/src-tauri/tauri.conf.json).

Removing Docker as a requirement means starting that same Java server directly and provisioning its external tools on the host. Browser and CEF clients continue to call the existing API. Removing the backend would instead require replacing server PDF operations, external conversion tools, configuration, jobs and persistence with new browser/native implementations; a WebView cannot supply those by itself. That replacement is outside this implementation and would lose functionality without a substantial port.

Design decision: add a native deployment workflow and a separate CEF launcher that loads the ordinary web UI from an owned local backend. Retain upstream Docker and Tauri workflows, PDF controllers, API contracts and dependency detection. Reuse the web `core` frontend instead of the Tauri-specific `desktop` layer: that layer expects Tauri APIs and participates in licensed cloud/proprietary cascades. [Layer resolution](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/AGENTS.md) documents the distinction.

## License boundaries

This is a source-license assessment, not a legal opinion or a complete distribution clearance. The root [LICENSE](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/LICENSE) applies MIT terms outside expressly excluded directories. It does **not** license the entire checkout as MIT. It defers `app/proprietary`, `app/saas`, `engine`, editor `proprietary`, `desktop`, `saas`, `cloud`, and all `frontend/src/processor` content to their own licenses. Retain notices when distributing MIT-covered content.

The inspected [proprietary license](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/proprietary/LICENSE) restricts production use and modification/distribution; the excluded directories carry Stirling PDF User License files. Do not copy those layers into a newly MIT-labelled desktop application or circumvent licensing checks. A customer with appropriate rights can separately choose a licensed build, subject to their agreement.

The upstream Gradle default includes proprietary backend functionality. `STIRLING_FLAVOR=core` selects the core backend and corresponding frontend mode. An independent `buildWithPortal` flag defaults to `true`, and `npmBuild` exports `VITE_INCLUDE_PORTAL=true` in that case. Native core packaging must explicitly set `-PbuildWithPortal=false` as well as selecting core. These switches are observations about build selection, not proof that every resulting dependency is permissively licensed. Evidence: [flavor selection](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/settings.gradle) and [frontend packaging flags](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/build.gradle).

JCEF's own [license](https://github.com/chromiumembedded/java-cef/blob/master/LICENSE.txt) uses BSD-style notice/disclaimer and endorsement conditions; the optional [jcefmaven helper](https://github.com/jcefmaven/jcefmaven/blob/master/LICENSE) is Apache-2.0. JCEF is Java bindings around CEF, so it meets the requested CEF embedding mechanism; it is not an operating-system WebView. A distributable must also retain the actual CEF/Chromium binary distribution's licenses, third-party notices, and licenses of bundled Java, native tools, fonts and libraries. Pinning a binary dependency does not itself fulfill those obligations. Recheck the exact shipped versions and notices before release.

## Native build and frontend hosting

The baseline uses Spring Boot 4.1.1 and a Java 25 toolchain by default; the version is explicit in [build.gradle](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/build.gradle). Do not apply an older JDK 17-era deployment recipe to this checkout.

`-PbuildWithFrontend=true` enables the upstream build/copy tasks that place Vite output in the backend static resources. Without it, the backend intentionally substitutes an API landing page. A desktop launcher pointing at a backend-only JAR will not magically display the editor. The build also invokes Task for the frontend; a JDK alone is insufficient to build the full UI. Development normally uses Vite on port 5173 and a proxy to backend port 8080. Serving bundled assets and APIs from one origin avoids a separate static server and CORS setup in a packaged release. Evidence: [backend frontend tasks](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/build.gradle) and [Vite](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/frontend/vite.config.ts).

## Startup, readiness, configuration and shutdown

| Source observation | Consequence for a native launcher |
| --- | --- |
| [`SPDFApplication`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/src/main/java/stirling/software/SPDF/SPDFApplication.java) creates/loads external settings before startup and records the bound port on `ApplicationReadyEvent`. | Launch the executable JAR with explicit arguments and a writable data directory. Wait for the launched child, not a fixed delay. |
| [`MetricsController`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/src/main/java/stirling/software/SPDF/controller/web/MetricsController.java) plus [`InfoApi`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/common/src/main/java/stirling/software/common/annotations/api/InfoApi.java) provide `/api/v1/info/status`, returning `status=UP` and a version. | Use a bounded HTTP probe and child-exit detection before navigation; a TCP listener alone is insufficient. This endpoint indicates the application is responding, not that every external converter works. |
| [`RequestUriUtils`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/common/src/main/java/stirling/software/common/util/RequestUriUtils.java) explicitly permits the status API through static-resource authorization; `/api/v1/info/health` is not given that same exception. | Prefer the exact `/api/v1/info/status` route, including an explicitly configured context path if supported. Do not accept an HTML login redirect as readiness. |
| [`application.properties`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/src/main/resources/application.properties) maps context path through `SYSTEM_ROOTURIPATH` and uses relative H2 path `./configs/...`. | Set the backend working directory to its data directory. `STIRLING_BASE_PATH` alone does not rewrite that default datasource URL. Keep state out of installed read-only program files. |
| [`InstallationPathConfig`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/common/src/main/java/stirling/software/common/configuration/InstallationPathConfig.java) supports `STIRLING_BASE_PATH` and `-Dstirling.base-path` for settings, logs, custom files and pipelines. | Preserve state across upgrades and isolate separate instances. |
| `BROWSER_OPEN=true` invokes the platform browser from application initialization. | Set it false for a CEF-owned session to avoid an extra browser window. |

A desktop-owned backend must bind to loopback, reject occupied explicit ports, and terminate only its own process tree. A readiness response from some already-running service must not cause the wrapper to adopt or kill it. On close, startup failure, interruption or CEF initialization failure, cleanup needs a bounded graceful phase followed by forced child termination. Server deployment instead belongs under a service manager with stop/restart policy; closing an ordinary browser must not stop that shared server. These are lifecycle design requirements, not guarantees inferred from the upstream health endpoint.

The core packaging profile omits the proprietary Spring Security layer. Loopback is the correct default for a local desktop session, but it is not per-user API authentication. Shared or public deployment needs an authenticated reverse proxy or an appropriately licensed build/security configuration, TLS, and restricted service-account permissions. Do not expose a core server simply by changing its bind address.

### Implemented supervision extension

The local implementation extends `TauriProcessMonitor` under an independent `STIRLING_PDF_MANAGED_MODE=true` condition. Native production and CEF launches explicitly set `STIRLING_PDF_TAURI_MODE=false`. This distinction matters: the upstream Tauri flag also disables pipeline routes/scanning and enables Tauri-specific CORS and desktop behavior. Managed mode activates only the process monitor; the existing Tauri conditions and pipeline feature rules remain unchanged.

Managed launchers pass unique readiness and shutdown paths through `STIRLING_PDF_READY_FILE` and `STIRLING_PDF_SHUTDOWN_FILE`, plus their parent PID through the compatibility name `TAURI_PARENT_PID`. On `ApplicationReadyEvent`, the backend atomically publishes its actual port to the readiness file. Each production launcher requires its own file and a successful `/api/v1/info/status` response before proceeding. Startup therefore does not depend on INFO messages or stdout formatting. A backend without this extension must be rebuilt before use with the new production launchers. Development continues to supervise Gradle/Vite and probe the HTTP endpoint.

The native core web build has produced an executable JAR with bundled frontend assets; inspection found no proprietary or SaaS backend module JARs in that build. Rebuild and stage the backend whenever changing the monitor so the launcher and its handshake remain compatible. Build success does not establish converter fidelity or CEF graphical behavior. Detailed execution results belong in the accompanying validation report.

The standalone `desktop/cef` project includes the matching CEF native JAR both in the distribution's `lib` directory and the generated launch-script classpath. Packaging supplies custom backend paths through Gradle's environment property mechanism, preserving spaces. The package task also verifies extraction from the native classpath with network mirrors disabled. This verifies provisioning separately from starting a graphical Chromium process.

## PDF feature preservation and host tools

Existing Java PDF processing remains in place. Some operations are pure Java or browser-assisted; others depend on host executables, supporting libraries, OCR languages, fonts or services. [`RuntimePathConfig`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/common/src/main/java/stirling/software/common/configuration/RuntimePathConfig.java) already distinguishes Docker paths from native command names and supports custom operation paths. No rewrite to browser-only processing is necessary.

[`ExternalAppDepConfig`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/core/src/main/java/stirling/software/SPDF/config/ExternalAppDepConfig.java) probes these dependencies and disables affected feature groups when they are missing:

| Dependency | Native deployment requirement |
| --- | --- |
| Ghostscript (`gs`) | Install a compatible executable under the expected command name. Windows installations may require a wrapper/path adjustment. |
| OCRmyPDF and Tesseract | Supply Python/native dependencies and required language data; configure `TESSDATA_PREFIX` or the application's tessdata directory. The default data path is Linux-specific. |
| qpdf | Baseline explicitly checks version 12.0.0 or newer. |
| WeasyPrint | Baseline explicitly checks version 58.0 or newer, plus its platform libraries. |
| LibreOffice (`soffice`), unoconvert | Install/configure conversion tools and any UNO service required by the chosen workflow. |
| Poppler (`pdftohtml`), Calibre (`ebook-convert`) | Supply these tools for their converter groups. |
| ImageMagick (`magick`), `rar` | Supply these for the relevant image/archive feature groups; installing a generic archive utility does not imply real CBR output support. |
| Python and OpenCV (`cv2`) | Supply these for Python-dependent operations. |

A healthy HTTP response is compatible with disabled dependency groups. A native package without those tools preserves the implemented PDF APIs but cannot claim feature parity with a fully provisioned fat image. Dependency presence also does not prove conversion fidelity: test representative PDFs, office formats, OCR languages and fonts on each supported operating system. Architecture-specific Java/PDFium/JCEF native libraries remain an additional compatibility boundary.

The optional Python AI engine is a distinct service; it is not required to replace the Java PDF processor. Its own directory is under the separately scoped User License. It should not be silently bundled into the core native package. Evidence: [engine contract and architecture guidance](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/AGENTS.md), [engine license](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/engine/LICENSE).

## Security and release limitations

The Docker image supplies more than executables. It installs a custom LibreOffice sandbox and a separate office user; [`ProcessExecutor`](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/app/common/src/main/java/stirling/software/common/util/ProcessExecutor.java) detects `/usr/local/lib/stirling/lo-sandbox`. Native execution does not automatically acquire that image-installed sandbox. Evidence: [base image hardening](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/docker/base/Dockerfile) and [sandbox implementation](https://github.com/Stirling-Tools/Stirling-PDF/blob/684608d143779bf3a8ffc67639f077a1202c62ff/docker/base/lo-sandbox.c). Use a restricted account, dedicated writable state/temp directories and OS filesystem/network controls appropriate to documents being processed. A CEF renderer sandbox does not isolate backend conversion subprocesses.

CEF support requires OS/architecture-specific native binaries and a graphical session. A build or unit test of lifecycle code is not an end-to-end proof of JCEF rendering, downloads, file upload dialogs, printing, accessibility, system integration, converter fidelity, installer signing, notarization, offline provisioning or update safety. Publish only after those release checks on each target. The implementation report should state precisely which of those were actually run; this source assessment does not claim any were executed.

## Evidence checklist

- Architecture, supported native build hooks and frontend hosting: answered by source.
- Docker removal versus backend removal: answered; retain Java server and existing PDF paths.
- License exclusions and core selection: answered at source-scope level; final artifact/dependency clearance remains release work.
- Configuration, health endpoint, data-path and lifecycle integration seams: answered by source; implementation tests are separate evidence.
- Host dependency parity and isolation: partially answered; required tools and image-only sandbox identified, actual host conversions remain platform validation.
- CEF desktop runtime and packaged installer behavior: unverified by this assessment.
