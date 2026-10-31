package stirling.software.SPDF.config.siriso;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.sun.net.httpserver.HttpServer;

import stirling.software.SPDF.config.siriso.SirisoAccessVerifier.Verdict;

import tools.jackson.databind.ObjectMapper;

/** Runs the verifier against a stub of the backoffice's {@code /api/siriso-pdf/auth/me}. */
class SirisoAccessVerifierTest {

    private static final String PRO = account("admin", true);
    private static final String FREE = account("user", false);

    private HttpServer backoffice;
    private final AtomicInteger hits = new AtomicInteger();
    private final AtomicReference<String> seenAuthorization = new AtomicReference<>();
    private volatile int status = 200;
    private volatile String body = PRO;

    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-31T00:00:00Z"));
    private SirisoAccessProperties properties;
    private SirisoAccessVerifier verifier;

    private static String account(String role, boolean workspace) {
        return """
                {"ok":true,"user":{"id":"u1","role":"%s","isPro":%s,\
                "access":{"workspace":%s,"adFree":%s,"desktop":%s,"admin":false}}}"""
                .formatted(role, workspace, workspace, workspace, workspace);
    }

    @BeforeEach
    void startBackoffice() throws IOException {
        backoffice =
                HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        backoffice.createContext(
                SirisoAccessVerifier.ACCOUNT_PATH,
                exchange -> {
                    hits.incrementAndGet();
                    seenAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(status, bytes.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(bytes);
                    }
                });
        backoffice.start();

        properties = new SirisoAccessProperties();
        properties.setEnforceAccess(true);
        properties.setBackofficeUrl("http://127.0.0.1:" + backoffice.getAddress().getPort() + "/");
        properties.setCacheSeconds(60);
        properties.setTimeoutSeconds(5);
        verifier = newVerifier();
    }

    @AfterEach
    void stopBackoffice() {
        backoffice.stop(0);
    }

    private SirisoAccessVerifier newVerifier() {
        return new SirisoAccessVerifier(
                properties,
                new ObjectMapper(),
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),
                clock);
    }

    @Nested
    @DisplayName("backoffice answers")
    class Answers {

        @Test
        @DisplayName("workspace access is GRANTED and the token is forwarded as a bearer")
        void granted() {
            assertEquals(Verdict.GRANTED, verifier.verify("tok.sig"));
            assertEquals("Bearer tok.sig", seenAuthorization.get());
        }

        @Test
        @DisplayName("a free account is NO_WORKSPACE")
        void free() {
            body = FREE;

            assertEquals(Verdict.NO_WORKSPACE, verifier.verify("free.sig"));
        }

        @Test
        @DisplayName("a response without access data is NO_WORKSPACE, not a grant")
        void missingAccess() {
            body = "{\"ok\":true,\"user\":{\"id\":\"u1\",\"isPro\":true}}";

            assertEquals(Verdict.NO_WORKSPACE, verifier.verify("tok.sig"));
        }

        @Test
        @DisplayName("a string \"true\" is not a grant")
        void stringTrue() {
            body = "{\"user\":{\"access\":{\"workspace\":\"true\"}}}";

            assertEquals(Verdict.NO_WORKSPACE, verifier.verify("tok.sig"));
        }

        @ParameterizedTest
        @ValueSource(ints = {401, 404})
        @DisplayName("401 and 404 mean the token is no longer usable")
        void invalid(int code) {
            status = code;
            body = "{\"ok\":false}";

            assertEquals(Verdict.INVALID_TOKEN, verifier.verify("tok.sig"));
        }

        @ParameterizedTest
        @ValueSource(ints = {429, 500, 502})
        @DisplayName("other statuses are UNAVAILABLE")
        void unavailable(int code) {
            status = code;

            assertEquals(Verdict.UNAVAILABLE, verifier.verify("tok.sig"));
        }

        @Test
        @DisplayName("unreadable JSON is UNAVAILABLE")
        void unreadable() {
            body = "<html>proxy error</html>";

            assertEquals(Verdict.UNAVAILABLE, verifier.verify("tok.sig"));
        }

        @Test
        @DisplayName("an unreachable backoffice is UNAVAILABLE")
        void unreachable() throws IOException {
            int closedPort;
            try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
                closedPort = socket.getLocalPort();
            }
            properties.setBackofficeUrl("http://127.0.0.1:" + closedPort);

            assertEquals(Verdict.UNAVAILABLE, newVerifier().verify("tok.sig"));
        }

        @Test
        @DisplayName("a blank backoffice URL is UNAVAILABLE")
        void blankUrl() {
            properties.setBackofficeUrl("  ");

            assertEquals(Verdict.UNAVAILABLE, newVerifier().verify("tok.sig"));
            assertEquals(0, hits.get());
        }
    }

    @Nested
    @DisplayName("malformed tokens")
    class Malformed {

        @ParameterizedTest
        @ValueSource(strings = {"has space", "line\nbreak", "quote\"", ""})
        @DisplayName("are rejected without calling the backoffice")
        void rejectedLocally(String token) {
            assertEquals(Verdict.INVALID_TOKEN, verifier.verify(token));
            assertEquals(0, hits.get());
        }

        @Test
        @DisplayName("an oversized token is rejected without calling the backoffice")
        void oversized() {
            assertEquals(Verdict.INVALID_TOKEN, verifier.verify("a".repeat(2049)));
            assertEquals(0, hits.get());
        }
    }

    @Nested
    @DisplayName("caching")
    class Caching {

        @Test
        @DisplayName("a grant is reused for cacheSeconds, then rechecked")
        void grantCached() {
            verifier.verify("tok.sig");
            clock.advance(Duration.ofSeconds(59));
            assertEquals(Verdict.GRANTED, verifier.verify("tok.sig"));
            assertEquals(1, hits.get());

            body = FREE;
            clock.advance(Duration.ofSeconds(2));
            assertEquals(Verdict.NO_WORKSPACE, verifier.verify("tok.sig"));
            assertEquals(2, hits.get());
        }

        @Test
        @DisplayName("a rejected token is reused for cacheSeconds")
        void invalidCached() {
            status = 401;
            verifier.verify("tok.sig");
            clock.advance(Duration.ofSeconds(30));
            verifier.verify("tok.sig");

            assertEquals(1, hits.get());
        }

        @Test
        @DisplayName("a free account is rechecked after a few seconds so an upgrade lands quickly")
        void noWorkspaceShortLived() {
            body = FREE;
            verifier.verify("free.sig");
            clock.advance(SirisoAccessVerifier.NO_WORKSPACE_TTL.minusSeconds(1));
            verifier.verify("free.sig");
            assertEquals(1, hits.get());

            body = PRO;
            clock.advance(Duration.ofSeconds(2));
            assertEquals(Verdict.GRANTED, verifier.verify("free.sig"));
            assertEquals(2, hits.get());
        }

        @Test
        @DisplayName("an outage is never cached")
        void outageNotCached() {
            status = 500;
            assertEquals(Verdict.UNAVAILABLE, verifier.verify("tok.sig"));

            status = 200;
            assertEquals(Verdict.GRANTED, verifier.verify("tok.sig"));
            assertEquals(2, hits.get());
        }

        @Test
        @DisplayName("tokens are cached independently")
        void perToken() {
            verifier.verify("pro.sig");
            body = FREE;

            assertEquals(Verdict.NO_WORKSPACE, verifier.verify("free.sig"));
            assertEquals(Verdict.GRANTED, verifier.verify("pro.sig"));
            assertEquals(2, hits.get());
        }

        @Test
        @DisplayName("cacheSeconds 0 asks the backoffice every time")
        void cacheDisabled() {
            properties.setCacheSeconds(0);
            verifier.verify("tok.sig");
            verifier.verify("tok.sig");

            assertEquals(2, hits.get());
            assertEquals(0, verifier.cacheSize());
        }
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
