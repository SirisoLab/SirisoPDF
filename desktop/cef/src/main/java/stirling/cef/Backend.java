package stirling.cef;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Owns one backend and its sentinel; never attaches to or terminates an existing server. */
final class Backend implements AutoCloseable {
    private final LauncherConfig config;
    private final Path sentinel;
    private final Path readyFile;
    private final AtomicBoolean closed = new AtomicBoolean();
    private Process process;

    Backend(LauncherConfig config) {
        this.config = config;
        sentinel = config.dataDir().resolve("shutdown-" + UUID.randomUUID());
        readyFile = Path.of(sentinel + ".ready");
    }

    URI start() throws Exception {
        if (!Files.isRegularFile(config.backendJar()))
            throw new IOException("Backend JAR missing: " + config.backendJar());
        Files.createDirectories(config.dataDir());
        try (var socket = new ServerSocket()) {
            socket.setReuseAddress(false);
            socket.bind(
                    new java.net.InetSocketAddress(
                            InetAddress.getByName("127.0.0.1"), config.port()));
        }
        var builder =
                new ProcessBuilder(command())
                        .directory(config.dataDir().toFile())
                        .redirectErrorStream(true)
                        .redirectOutput(config.dataDir().resolve("backend.log").toFile());
        builder.environment().put("BROWSER_OPEN", "false");
        builder.environment().put("UI_APPNAMENAVBAR", "Siriso PDF");
        builder.environment().put("STIRLING_BASE_PATH", config.dataDir().toString());
        builder.environment().put("TAURI_PARENT_PID", Long.toString(ProcessHandle.current().pid()));
        builder.environment().put("STIRLING_PDF_SHUTDOWN_FILE", sentinel.toString());
        builder.environment().put("STIRLING_PDF_READY_FILE", readyFile.toString());
        process = builder.start();
        long deadline = System.nanoTime() + config.startupTimeout().toNanos();
        URI origin = URI.create("http://127.0.0.1:" + config.port());
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) throw new IOException("Backend exited before readiness");
            if (!Files.isRegularFile(readyFile)
                    || !Files.readString(readyFile)
                            .trim()
                            .equals(Integer.toString(config.port()))) {
                TimeUnit.MILLISECONDS.sleep(200);
                continue;
            }
            try {
                var response =
                        client.send(
                                HttpRequest.newBuilder(origin.resolve("/api/v1/info/status"))
                                        .timeout(Duration.ofSeconds(2))
                                        .build(),
                                HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200
                        && response.body().matches("(?s).*\\\"status\\\"\\s*:\\s*\\\"UP\\\".*"))
                    if (process.isAlive()) return origin;
            } catch (IOException ignored) {
            }
            TimeUnit.MILLISECONDS.sleep(200);
        }
        throw new IOException(
                "Backend readiness timed out; see " + config.dataDir().resolve("backend.log"));
    }

    List<String> command() {
        return List.of(
                config.javaExecutable().toString(),
                "--enable-native-access=ALL-UNNAMED",
                "-Dstirling.base-path=" + config.dataDir(),
                "-DSTIRLING_PDF_MANAGED_MODE=true",
                "-DSTIRLING_PDF_TAURI_MODE=false",
                "-jar",
                config.backendJar().toString(),
                "--server.address=127.0.0.1",
                "--server.port=" + config.port(),
                "--server.servlet.context-path=/",
                "--server.shutdown=graceful",
                "--spring.lifecycle.timeout-per-shutdown-phase=20s",
                "--spring.main.headless=true");
    }

    CompletableFuture<Process> onExit() {
        return process.onExit();
    }

    boolean isClosing() {
        return closed.get();
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true) || process == null) return;
        var descendants = process.descendants().toList();
        try {
            Files.writeString(sentinel, "shutdown");
            if (!process.waitFor(config.shutdownTimeout().toMillis(), TimeUnit.MILLISECONDS)) {
                descendants.forEach(ProcessHandle::destroy);
                process.destroy();
                if (!process.waitFor(2, TimeUnit.SECONDS))
                    process.destroyForcibly().waitFor(2, TimeUnit.SECONDS);
            }
        } catch (InterruptedException e) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
        } catch (IOException e) {
            process.destroyForcibly();
        } finally {
            descendants.stream()
                    .filter(ProcessHandle::isAlive)
                    .forEach(ProcessHandle::destroyForcibly);
            try {
                Files.deleteIfExists(sentinel);
                Files.deleteIfExists(readyFile);
            } catch (IOException ignored) {
            }
        }
    }
}
