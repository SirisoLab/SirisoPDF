package stirling.cef;

import static org.junit.jupiter.api.Assertions.*;

import java.net.ServerSocket;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.jar.Attributes;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.zip.ZipEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LauncherTest {
    @TempDir Path temp;

    @Test
    void configUsesFileLocationAndRejectsInvalidPort() throws Exception {
        Path file = temp.resolve("launcher.properties");
        Files.writeString(file, "backendJar=backend/test jar.jar\ndataDir=user data\nport=18880\n");
        var config = LauncherConfig.load(file);
        assertEquals(temp.resolve("backend/test jar.jar"), config.backendJar());
        assertEquals(temp.resolve("user data"), config.dataDir());
        Files.writeString(file, "port=0\n");
        assertThrows(IllegalArgumentException.class, () -> LauncherConfig.load(file));
    }

    @Test
    void navigationRejectsOtherOriginsAndDangerousSchemes() {
        var origin = URI.create("http://127.0.0.1:8780");
        assertTrue(Navigation.allowed(origin, origin + "/merge-pdfs?q=a"));
        assertFalse(Navigation.allowed(origin, "http://127.0.0.1:8781/"));
        assertFalse(Navigation.allowed(origin, "http://localhost:8780/"));
        assertFalse(Navigation.allowed(origin, "https://example.com/"));
        assertFalse(Navigation.allowed(origin, "javascript:alert(1)"));
        assertFalse(Navigation.allowed(origin, "file:///etc/passwd"));
        assertFalse(Navigation.allowed(origin, "http://user@127.0.0.1:8780/"));
    }

    @Test
    void occupiedPortDoesNotAttachToExistingService() throws Exception {
        try (var occupied = new ServerSocket(0);
                var backend = new Backend(config(fakeJar(), occupied.getLocalPort()))) {
            assertThrows(java.io.IOException.class, backend::start);
            assertFalse(occupied.isClosed());
        }
    }

    @Test
    void ownedProcessBecomesReadyAndStopsGracefully() throws Exception {
        int port;
        try (var socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        var config = config(fakeJar(), port);
        try (var backend = new Backend(config)) {
            assertEquals(URI.create("http://127.0.0.1:" + port), backend.start());
            backend.close();
            assertFalse(backend.onExit().get().isAlive());
            assertTrue(Files.exists(config.dataDir().resolve("clean-exit")));
            backend.close();
        }
        try (var paths = Files.list(config.dataDir())) {
            assertFalse(paths.anyMatch(p -> p.getFileName().toString().startsWith("shutdown-")));
        }
    }

    @Test
    void failedStartupIsReportedAndCleanupIsSafe() throws Exception {
        Path invalid = temp.resolve("invalid.jar");
        Files.writeString(invalid, "not a jar");
        int port;
        try (var socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        try (var backend = new Backend(config(invalid, port))) {
            assertThrows(Exception.class, backend::start);
            backend.close();
            assertFalse(backend.onExit().get().isAlive());
        }
    }

    @Test
    void healthyHttpServerWithoutOwnedReadyFileTimesOutAndIsStopped() throws Exception {
        int port;
        try (var socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        var normal = config(fakeJar("no-ready.jar"), port);
        var limited =
                new LauncherConfig(
                        normal.javaExecutable(),
                        normal.backendJar(),
                        normal.dataDir(),
                        port,
                        Duration.ofSeconds(1),
                        normal.shutdownTimeout());
        try (var backend = new Backend(limited)) {
            assertThrows(java.io.IOException.class, backend::start);
            backend.close();
            assertFalse(backend.onExit().get().isAlive());
            assertTrue(Files.exists(limited.dataDir().resolve("clean-exit")));
        }
    }

    @Test
    void supervisionDoesNotEnableTauriMode() throws Exception {
        try (var backend = new Backend(config(fakeJar(), 8780))) {
            assertTrue(backend.command().contains("-DSTIRLING_PDF_MANAGED_MODE=true"));
            assertTrue(backend.command().contains("-DSTIRLING_PDF_TAURI_MODE=false"));
            assertFalse(backend.command().contains("-DSTIRLING_PDF_TAURI_MODE=true"));
        }
    }

    private LauncherConfig config(Path jar, int port) {
        String executable =
                System.getProperty("os.name").toLowerCase().contains("win") ? "java.exe" : "java";
        return new LauncherConfig(
                Path.of(System.getProperty("java.home"), "bin", executable),
                jar,
                temp.resolve("state with spaces"),
                port,
                Duration.ofSeconds(15),
                Duration.ofSeconds(5));
    }

    private Path fakeJar() throws Exception {
        return fakeJar("fake backend.jar");
    }

    private Path fakeJar(String filename) throws Exception {
        Path jar = temp.resolve(filename);
        var manifest = new Manifest();
        manifest.getMainAttributes().put(Attributes.Name.MANIFEST_VERSION, "1.0");
        manifest.getMainAttributes().put(Attributes.Name.MAIN_CLASS, FakeBackend.class.getName());
        String resource = FakeBackend.class.getName().replace('.', '/') + ".class";
        try (var out = new JarOutputStream(Files.newOutputStream(jar), manifest);
                var in = FakeBackend.class.getClassLoader().getResourceAsStream(resource)) {
            out.putNextEntry(new ZipEntry(resource));
            in.transferTo(out);
            out.closeEntry();
        }
        return jar;
    }
}
