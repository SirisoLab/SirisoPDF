import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getBrowserId } from "@editor/utils/browserIdentifier";
import { getStoredProState } from "@editor/services/sirisoProService";

/**
 * The signed-in Siriso customer's bearer, which the engine's paywall (`siriso.enforceAccess`)
 * checks on /api/v1. Empty while nobody is signed in, so an open engine sees no change.
 */
function sirisoAuthHeaders(): Record<string, string> {
  const token = getStoredProState().authToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Only the engine gets the customer token: an absolute URL to any other origin must not. */
function targetsEngine(
  client: AxiosInstance,
  config: InternalAxiosRequestConfig,
): boolean {
  try {
    const here = globalThis.location?.href ?? "http://localhost/";
    const engine = new URL(config.baseURL || "/", here).origin;
    return new URL(client.getUri(config), here).origin === engine;
  } catch {
    return false;
  }
}

export function setupApiInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use(
    (config) => {
      // Add browser ID header for WAU tracking
      const browserId = getBrowserId();
      config.headers["X-Browser-Id"] = browserId;
      if (!config.headers.Authorization && targetsEngine(client, config)) {
        config.headers.set(sirisoAuthHeaders());
      }
      return config;
    },
    (error) => Promise.reject(error),
  );
}

/** Auth headers for raw fetch() calls to the engine: the Siriso bearer in core; proprietary/SaaS override. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  return sirisoAuthHeaders();
}
