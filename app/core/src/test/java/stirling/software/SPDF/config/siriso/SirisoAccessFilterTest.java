package stirling.software.SPDF.config.siriso;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import stirling.software.SPDF.config.siriso.SirisoAccessVerifier.Verdict;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SirisoAccessFilterTest {

    private static final String PROCESSING = "/api/v1/misc/compress-pdf";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private SirisoAccessProperties properties;
    private SirisoAccessVerifier verifier;
    private SirisoAccessFilter filter;

    @BeforeEach
    void setUp() {
        properties = new SirisoAccessProperties();
        properties.setEnforceAccess(true);
        verifier = mock(SirisoAccessVerifier.class);
        filter = new SirisoAccessFilter(properties, verifier, objectMapper);
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        return request;
    }

    private static MockHttpServletRequest post(String path, String authorization) {
        MockHttpServletRequest request = request("POST", path);
        if (authorization != null) {
            request.addHeader("Authorization", authorization);
        }
        return request;
    }

    private record Outcome(MockHttpServletResponse response, MockFilterChain chain) {
        boolean passed() {
            return chain.getRequest() != null;
        }
    }

    private Outcome run(MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return new Outcome(response, chain);
    }

    private JsonNode body(Outcome outcome) throws Exception {
        return objectMapper.readTree(outcome.response().getContentAsString());
    }

    @Nested
    @DisplayName("setting off")
    class Disabled {

        @Test
        @DisplayName("lets an anonymous processing call through without asking the backoffice")
        void anonymousProcessingPasses() throws Exception {
            properties.setEnforceAccess(false);

            Outcome outcome = run(post(PROCESSING, null));

            assertTrue(outcome.passed());
            assertEquals(200, outcome.response().getStatus());
            verify(verifier, never()).verify(anyString());
        }
    }

    @Nested
    @DisplayName("processing endpoints with the setting on")
    class Processing {

        @Test
        @DisplayName("401 without a token")
        void missingToken() throws Exception {
            Outcome outcome = run(post(PROCESSING, null));

            assertEquals(401, outcome.response().getStatus());
            assertEquals("login-required", outcome.response().getHeader("X-Siriso-Access"));
            assertNotNull(outcome.response().getHeader("WWW-Authenticate"));
            assertEquals("no-store", outcome.response().getHeader("Cache-Control"));
            assertEquals("login-required", body(outcome).path("error").asString());
            assertEquals(401, body(outcome).path("status").asInt());
            assertTrue(outcome.response().getContentType().startsWith("application/json"));
            assertNull(outcome.chain().getRequest());
            verify(verifier, never()).verify(anyString());
        }

        @Test
        @DisplayName("401 for a non-bearer Authorization header")
        void basicAuthIsNotAToken() throws Exception {
            Outcome outcome = run(post(PROCESSING, "Basic dXNlcjpwYXNz"));

            assertEquals(401, outcome.response().getStatus());
            verify(verifier, never()).verify(anyString());
        }

        @Test
        @DisplayName("401 for an empty bearer token")
        void emptyBearer() throws Exception {
            Outcome outcome = run(post(PROCESSING, "Bearer   "));

            assertEquals(401, outcome.response().getStatus());
            verify(verifier, never()).verify(anyString());
        }

        @Test
        @DisplayName("401 when the backoffice rejects the token")
        void invalidToken() throws Exception {
            when(verifier.verify("expired")).thenReturn(Verdict.INVALID_TOKEN);

            Outcome outcome = run(post(PROCESSING, "Bearer expired"));

            assertEquals(401, outcome.response().getStatus());
            assertEquals("login-required", outcome.response().getHeader("X-Siriso-Access"));
            assertNull(outcome.chain().getRequest());
        }

        @Test
        @DisplayName("402 for a free account without workspace access")
        void freeAccount() throws Exception {
            when(verifier.verify("free-token")).thenReturn(Verdict.NO_WORKSPACE);

            Outcome outcome = run(post(PROCESSING, "Bearer free-token"));

            assertEquals(402, outcome.response().getStatus());
            assertEquals("pro-required", outcome.response().getHeader("X-Siriso-Access"));
            assertNull(outcome.response().getHeader("WWW-Authenticate"));
            assertEquals("pro-required", body(outcome).path("error").asString());
            assertNull(outcome.chain().getRequest());
        }

        @Test
        @DisplayName("passes a Pro, staff or admin account the backoffice grants")
        void grantedAccount() throws Exception {
            MockHttpServletRequest request = post(PROCESSING, "Bearer pro-token");
            when(verifier.verify("pro-token")).thenReturn(Verdict.GRANTED);

            Outcome outcome = run(request);

            assertSame(request, outcome.chain().getRequest());
            assertEquals(200, outcome.response().getStatus());
            assertNull(outcome.response().getHeader("X-Siriso-Access"));
        }

        @Test
        @DisplayName("503 while the backoffice cannot answer")
        void backofficeDown() throws Exception {
            when(verifier.verify("pro-token")).thenReturn(Verdict.UNAVAILABLE);

            Outcome outcome = run(post(PROCESSING, "Bearer pro-token"));

            assertEquals(503, outcome.response().getStatus());
            assertEquals("unavailable", outcome.response().getHeader("X-Siriso-Access"));
            assertNull(outcome.chain().getRequest());
        }

        @Test
        @DisplayName("accepts the bearer scheme in any case and trims the token")
        void bearerSchemeIsCaseInsensitive() throws Exception {
            when(verifier.verify("pro-token")).thenReturn(Verdict.GRANTED);

            Outcome outcome = run(post(PROCESSING, "bearer  pro-token "));

            assertTrue(outcome.passed());
        }

        @Test
        @DisplayName("gates non-POST API calls too")
        void gatesGetJobResults() throws Exception {
            Outcome outcome = run(request("GET", "/api/v1/general/job/123/result"));

            assertEquals(401, outcome.response().getStatus());
        }

        @Test
        @DisplayName("strips the context path before matching")
        void contextPath() throws Exception {
            MockHttpServletRequest gated = post("/pdf" + PROCESSING, null);
            gated.setContextPath("/pdf");
            gated.setServletPath(PROCESSING);
            MockHttpServletRequest open = request("GET", "/pdf/api/v1/config/app-config");
            open.setContextPath("/pdf");
            open.setServletPath("/api/v1/config/app-config");

            assertEquals(401, run(gated).response().getStatus());
            assertTrue(run(open).passed());
        }
    }

    @Nested
    @DisplayName("open paths with the setting on")
    class OpenPaths {

        @ParameterizedTest
        @ValueSource(
                strings = {
                    "/api/v1/config/app-config",
                    "/api/v1/config/endpoints-availability",
                    "/api/v1/ui-data/footer-info",
                    "/api/v1/info/status"
                })
        @DisplayName("boot and UI-data endpoints need no token")
        void bootEndpoints(String path) throws Exception {
            assertTrue(run(request("GET", path)).passed());
            verify(verifier, never()).verify(anyString());
        }

        @ParameterizedTest
        @ValueSource(
                strings = {
                    "/",
                    "/index.html",
                    "/assets/index.js",
                    "/compress",
                    "/api/siriso-pdf/auth/me"
                })
        @DisplayName("the SPA and the same-origin backoffice probe are not engine API calls")
        void nonApiPaths(String path) throws Exception {
            assertTrue(run(request("GET", path)).passed());
        }

        @Test
        @DisplayName("CORS preflight passes")
        void preflight() throws Exception {
            assertTrue(run(request("OPTIONS", PROCESSING)).passed());
        }
    }

    @Nested
    @DisplayName("path tricks with the setting on")
    class PathTricks {

        @ParameterizedTest
        @ValueSource(
                strings = {
                    "/api/v1/config/..;/misc/compress-pdf",
                    "/api/v1/config/../misc/compress-pdf",
                    "/api/v1/config/%2e%2e/misc/compress-pdf",
                    "/api/v1/config//../misc/compress-pdf",
                    "/api/v1/config/app-config;x=/../../misc/compress-pdf"
                })
        @DisplayName("an open prefix cannot be used to reach a processing endpoint")
        void traversalOffOpenPrefix(String rawPath) throws Exception {
            MockHttpServletRequest request = post(rawPath, null);
            request.setServletPath(PROCESSING);

            assertEquals(401, run(request).response().getStatus());
        }

        @Test
        @DisplayName("a raw path outside the API that Tomcat normalises into it is still gated")
        void normalisedIntoApi() throws Exception {
            MockHttpServletRequest request = post("/assets/../api/v1/misc/compress-pdf", null);
            request.setServletPath(PROCESSING);

            assertEquals(401, run(request).response().getStatus());
        }

        @Test
        @DisplayName("upper-case API paths are gated")
        void upperCase() throws Exception {
            assertEquals(401, run(post("/API/V1/misc/compress-pdf", null)).response().getStatus());
        }
    }
}
