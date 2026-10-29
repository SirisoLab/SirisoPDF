package stirling.cef;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.util.Arrays;

/** A real child JVM exercising the launcher protocol without PDF or CEF dependencies. */
public final class FakeBackend {
    public static void main(String[] args) throws Exception {
        int port =
                Integer.parseInt(
                        Arrays.stream(args)
                                .filter(a -> a.startsWith("--server.port="))
                                .findFirst()
                                .orElseThrow()
                                .substring("--server.port=".length()));
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext(
                "/api/v1/info/status",
                exchange -> {
                    byte[] body = "{\"status\":\"UP\"}".getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, body.length);
                    try (var stream = exchange.getResponseBody()) {
                        stream.write(body);
                    }
                });
        Path sentinel = Path.of(System.getenv("STIRLING_PDF_SHUTDOWN_FILE"));
        try (var watcher = sentinel.getFileSystem().newWatchService()) {
            sentinel.getParent().register(watcher, StandardWatchEventKinds.ENTRY_CREATE);
            server.start();
            if (!System.getProperty("java.class.path").contains("no-ready")) {
                Files.writeString(Path.of(System.getenv("STIRLING_PDF_READY_FILE")), port + "\n");
            }
            while (!Files.exists(sentinel)) {
                watcher.take().reset();
            }
        } finally {
            server.stop(0);
        }
        Files.writeString(sentinel.getParent().resolve("clean-exit"), "ok");
    }
}
