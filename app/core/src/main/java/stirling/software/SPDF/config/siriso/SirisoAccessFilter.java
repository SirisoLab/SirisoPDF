package stirling.software.SPDF.config.siriso;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.ObjectMapper;

/**
 * Server-side half of the Siriso paywall. With {@code siriso.enforceAccess} on, every {@code
 * /api/v1/**} call needs {@code Authorization: Bearer <Siriso customer token>} for an account the
 * backoffice grants workspace access: 401 without a usable token, 402 without workspace access, 503
 * while the backoffice cannot answer. Boot and UI-data endpoints stay open because the landing page
 * reads them before anyone signs in. With the setting off every request passes untouched.
 *
 * <p>Rejections carry {@value #DENIAL_HEADER} so the frontend can tell them apart from Stirling's
 * own login errors.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
public class SirisoAccessFilter extends OncePerRequestFilter {

    static final String DENIAL_HEADER = "X-Siriso-Access";

    private static final String API_PREFIX = "/api/v1/";

    static final List<String> PUBLIC_PREFIXES =
            List.of("/api/v1/config/", "/api/v1/ui-data/", "/api/v1/info/status");

    enum Denial {
        LOGIN_REQUIRED(
                HttpServletResponse.SC_UNAUTHORIZED,
                "login-required",
                "Silakan masuk ke akun Siriso PDF untuk memakai alat PDF."),
        PRO_REQUIRED(
                HttpServletResponse.SC_PAYMENT_REQUIRED,
                "pro-required",
                "Akun Anda belum memiliki akses Workspace. Aktifkan Paket Pro untuk memakai alat"
                        + " PDF."),
        UNAVAILABLE(
                HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                "unavailable",
                "Layanan akun Siriso sedang tidak dapat dihubungi. Coba lagi sebentar lagi.");

        final int status;
        final String code;
        final String message;

        Denial(int status, String code, String message) {
            this.status = status;
            this.code = code;
            this.message = message;
        }
    }

    private final SirisoAccessProperties properties;
    private final SirisoAccessVerifier verifier;
    private final ObjectMapper objectMapper;

    @PostConstruct
    void logGateState() {
        if (properties.isEnforceAccess()) {
            log.info(
                    "Siriso access gate on: /api/v1 needs a customer token checked against {}",
                    properties.getBackofficeUrl());
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.isEnforceAccess() || HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String rawPath = rawPath(request);
        boolean api = isApi(rawPath) || isApi(normalizedPath(request));
        return !api || isPublic(rawPath);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = bearerToken(request);
        if (token == null) {
            deny(response, Denial.LOGIN_REQUIRED);
            return;
        }
        switch (verifier.verify(token)) {
            case GRANTED -> chain.doFilter(request, response);
            case NO_WORKSPACE -> deny(response, Denial.PRO_REQUIRED);
            case INVALID_TOKEN -> deny(response, Denial.LOGIN_REQUIRED);
            case UNAVAILABLE -> deny(response, Denial.UNAVAILABLE);
        }
    }

    private void deny(HttpServletResponse response, Denial denial) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", denial.status);
        body.put("error", denial.code);
        body.put("message", denial.message);

        response.setStatus(denial.status);
        response.setHeader(DENIAL_HEADER, denial.code);
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (denial == Denial.LOGIN_REQUIRED) {
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer realm=\"Siriso PDF\"");
        }
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private static String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = header.substring(7).strip();
        return token.isEmpty() ? null : token;
    }

    private static boolean isApi(String path) {
        return path.regionMatches(true, 0, API_PREFIX, 0, API_PREFIX.length());
    }

    /**
     * Only a plain path can be public: Tomcat decodes and normalises {@code %2e}, {@code ;} and
     * {@code ..} before routing, so {@code /api/v1/config/..;/misc/compress-pdf} must not ride on
     * the open config prefix.
     */
    private static boolean isPublic(String rawPath) {
        if (rawPath.contains("..")
                || rawPath.contains("//")
                || rawPath.indexOf(';') >= 0
                || rawPath.indexOf('%') >= 0
                || rawPath.indexOf('\\') >= 0) {
            return false;
        }
        return PUBLIC_PREFIXES.stream().anyMatch(rawPath::startsWith);
    }

    private static String rawPath(HttpServletRequest request) {
        String uri = request.getRequestURI() == null ? "" : request.getRequestURI();
        String contextPath = request.getContextPath();
        return contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)
                ? uri.substring(contextPath.length())
                : uri;
    }

    private static String normalizedPath(HttpServletRequest request) {
        String servletPath = request.getServletPath() == null ? "" : request.getServletPath();
        String pathInfo = request.getPathInfo() == null ? "" : request.getPathInfo();
        return servletPath + pathInfo;
    }
}
