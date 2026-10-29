package stirling.cef;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Properties;

/** Local launcher configuration; relative paths are anchored to the selected properties file. */
record LauncherConfig(
        Path javaExecutable,
        Path backendJar,
        Path dataDir,
        int port,
        Duration startupTimeout,
        Duration shutdownTimeout) {
    static LauncherConfig load(Path file) throws IOException {
        var properties = new Properties();
        Path base = file.toAbsolutePath().normalize().getParent();
        if (Files.exists(file)) {
            try (var input = Files.newInputStream(file)) {
                properties.load(input);
            }
        }
        String os = System.getProperty("os.name").toLowerCase();
        Path java =
                Path.of(
                        System.getProperty("java.home"),
                        "bin",
                        os.contains("win") ? "java.exe" : "java");
        String local = System.getenv("LOCALAPPDATA");
        Path data =
                os.contains("win") && local != null
                        ? Path.of(local, "SirisoPDF-CEF")
                        : os.contains("mac")
                                ? Path.of(
                                        System.getProperty("user.home"),
                                        "Library",
                                        "Application Support",
                                        "SirisoPDF-CEF")
                                : Path.of(
                                        System.getenv()
                                                .getOrDefault(
                                                        "XDG_DATA_HOME",
                                                        Path.of(
                                                                        System.getProperty(
                                                                                "user.home"),
                                                                        ".local",
                                                                        "share")
                                                                .toString()),
                                        "siriso-pdf-cef");
        int port = number(properties, "port", 8780, 1, 65535);
        return new LauncherConfig(
                resolve(base, properties.getProperty("javaExecutable", java.toString())),
                resolve(base, properties.getProperty("backendJar", "backend/stirling-pdf.jar")),
                resolve(base, properties.getProperty("dataDir", data.toString())),
                port,
                Duration.ofSeconds(number(properties, "startupTimeoutSeconds", 180, 1, 3600)),
                Duration.ofSeconds(number(properties, "shutdownTimeoutSeconds", 35, 1, 300)));
    }

    private static Path resolve(Path base, String value) {
        return base.resolve(value).toAbsolutePath().normalize();
    }

    private static int number(Properties properties, String name, int fallback, int min, int max) {
        int value = Integer.parseInt(properties.getProperty(name, Integer.toString(fallback)));
        if (value < min || value > max)
            throw new IllegalArgumentException(name + " must be " + min + ".." + max);
        return value;
    }
}
