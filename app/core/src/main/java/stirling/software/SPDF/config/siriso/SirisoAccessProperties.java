package stirling.software.SPDF.config.siriso;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

/**
 * Server-side Siriso paywall ({@code siriso.*}), usually set in {@code
 * configs/custom_settings.yml}. Off by default so local and development runs keep an open engine
 * API.
 */
@Data
@Component
@ConfigurationProperties(prefix = "siriso")
public class SirisoAccessProperties {

    /** Require a Siriso customer token with workspace access on {@code /api/v1/**}. */
    private boolean enforceAccess = false;

    /** Siriso backoffice origin that serves {@code /api/siriso-pdf/auth/me}. */
    private String backofficeUrl = "http://localhost:8000";

    /** How long a granted or rejected token is trusted before asking the backoffice again. */
    private long cacheSeconds = 60;

    /** Connect and response timeout for the backoffice call. */
    private long timeoutSeconds = 5;
}
