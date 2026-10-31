package stirling.software.SPDF.config.siriso;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Asks the Siriso backoffice ({@code GET /api/siriso-pdf/auth/me}) whether a customer token may use
 * the workspace, and remembers the answer per token. The backoffice's {@code user.access.workspace}
 * already folds in role, Pro status and the access policy, so it is the only field read.
 * Thread-safe.
 */
@Slf4j
@Component
public class SirisoAccessVerifier {

    public enum Verdict {
        GRANTED,
        /** Signed in, but neither Pro, staff nor admin while the policy requires Pro. */
        NO_WORKSPACE,
        /** Expired, forged or malformed token, or the account no longer exists. */
        INVALID_TOKEN,
        /** The backoffice could not answer; never cached. */
        UNAVAILABLE
    }

    static final String ACCOUNT_PATH = "/api/siriso-pdf/auth/me";

    /** A free account that just paid must not wait a whole cache window to be let in. */
    static final Duration NO_WORKSPACE_TTL = Duration.ofSeconds(5);

    static final int MAX_CACHE_ENTRIES = 10_000;

    private static final int MAX_TOKEN_LENGTH = 2048;
    private static final Pattern TOKEN_CHARS = Pattern.compile("[A-Za-z0-9._~+/=-]+");

    private final SirisoAccessProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Clock clock;
    private final Map<String, CachedVerdict> cache = new ConcurrentHashMap<>();

    @Autowired
    public SirisoAccessVerifier(SirisoAccessProperties properties, ObjectMapper objectMapper) {
        this(
                properties,
                objectMapper,
                HttpClient.newBuilder().connectTimeout(timeout(properties)).build(),
                Clock.systemUTC());
    }

    SirisoAccessVerifier(
            SirisoAccessProperties properties,
            ObjectMapper objectMapper,
            HttpClient httpClient,
            Clock clock) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.clock = clock;
    }

    /**
     * Never throws. A cache miss blocks for up to {@code siriso.timeoutSeconds} on the backoffice
     * call; a null or malformed token is {@link Verdict#INVALID_TOKEN} without one.
     */
    public Verdict verify(String token) {
        if (token == null
                || token.length() > MAX_TOKEN_LENGTH
                || !TOKEN_CHARS.matcher(token).matches()) {
            return Verdict.INVALID_TOKEN;
        }
        String key = sha256(token);
        Instant now = clock.instant();
        CachedVerdict cached = cache.get(key);
        if (cached != null && now.isBefore(cached.expiresAt())) {
            return cached.verdict();
        }
        Verdict verdict = askBackoffice(token);
        remember(key, verdict, now);
        return verdict;
    }

    int cacheSize() {
        return cache.size();
    }

    private Verdict askBackoffice(String token) {
        String base = properties.getBackofficeUrl() == null ? "" : properties.getBackofficeUrl();
        base = base.strip().replaceAll("/+$", "");
        HttpRequest request;
        try {
            request =
                    HttpRequest.newBuilder(URI.create(base + ACCOUNT_PATH))
                            .timeout(timeout(properties))
                            .header("Authorization", "Bearer " + token)
                            .header("Accept", "application/json")
                            .GET()
                            .build();
        } catch (IllegalArgumentException e) {
            log.error("siriso.backofficeUrl '{}' is not a usable http(s) URL", base);
            return Verdict.UNAVAILABLE;
        }
        try {
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return switch (response.statusCode()) {
                case 200 -> workspaceVerdict(response.body());
                case 401, 404 -> Verdict.INVALID_TOKEN;
                default -> {
                    log.warn(
                            "Siriso backoffice answered {} for {}",
                            response.statusCode(),
                            request.uri());
                    yield Verdict.UNAVAILABLE;
                }
            };
        } catch (IOException e) {
            log.warn("Siriso backoffice unreachable at {}: {}", request.uri(), e.toString());
            return Verdict.UNAVAILABLE;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Verdict.UNAVAILABLE;
        }
    }

    private Verdict workspaceVerdict(String body) {
        try {
            JsonNode workspace =
                    objectMapper.readTree(body).path("user").path("access").path("workspace");
            return workspace.booleanValue(false) ? Verdict.GRANTED : Verdict.NO_WORKSPACE;
        } catch (JacksonException e) {
            log.warn("Siriso backoffice returned unreadable account data: {}", e.getMessage());
            return Verdict.UNAVAILABLE;
        }
    }

    private void remember(String key, Verdict verdict, Instant now) {
        Duration window = Duration.ofSeconds(Math.max(0, properties.getCacheSeconds()));
        Duration ttl =
                switch (verdict) {
                    case GRANTED, INVALID_TOKEN -> window;
                    case NO_WORKSPACE ->
                            window.compareTo(NO_WORKSPACE_TTL) < 0 ? window : NO_WORKSPACE_TTL;
                    case UNAVAILABLE -> Duration.ZERO;
                };
        if (ttl.isZero()) {
            cache.remove(key);
            return;
        }
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.values().removeIf(entry -> !now.isBefore(entry.expiresAt()));
            if (cache.size() >= MAX_CACHE_ENTRIES) {
                cache.clear();
            }
        }
        cache.put(key, new CachedVerdict(verdict, now.plus(ttl)));
    }

    private static Duration timeout(SirisoAccessProperties properties) {
        return Duration.ofSeconds(Math.max(1, properties.getTimeoutSeconds()));
    }

    /** Cache keys are digests so the long-lived cache holds no reusable customer token. */
    private static String sha256(String token) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }

    private record CachedVerdict(Verdict verdict, Instant expiresAt) {}
}
