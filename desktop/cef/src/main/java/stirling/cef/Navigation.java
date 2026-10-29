package stirling.cef;

import java.net.URI;

/** Top-level browsing stays on the owned backend; downloads use CEF's native save dialog. */
final class Navigation {
    static boolean allowed(URI origin, String target) {
        try {
            URI uri = URI.create(target);
            return "about:blank".equals(target)
                    || (origin.getScheme().equals(uri.getScheme())
                            && origin.getHost().equals(uri.getHost())
                            && origin.getPort() == uri.getPort()
                            && uri.getUserInfo() == null);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
