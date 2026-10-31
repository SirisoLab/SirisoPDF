import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alert } from "@editor/components/toast";
import { SIRISO_ACCESS_DENIED_EVENT } from "@editor/services/sirisoProService";
import { handleHttpError } from "@editor/services/httpErrorHandler";

vi.mock("@editor/components/toast", () => ({ alert: vi.fn() }));
vi.mock("@editor/services/specialErrorToasts", () => ({
  showSpecialErrorToast: vi.fn(() => false),
}));
vi.mock("@editor/services/saasErrorInterceptor", () => ({
  handleSaaSError: vi.fn(() => false),
}));
vi.mock("@editor/services/errorUtils", () => ({
  broadcastErroredFiles: vi.fn(),
  extractErrorFileIds: vi.fn(() => []),
  normalizeAxiosErrorData: vi.fn(async (d: unknown) => d),
}));

const hrefs: string[] = [];

function denial(
  status: number,
  code: string,
  data: unknown = {},
  config: Record<string, unknown> = {},
) {
  return {
    isAxiosError: true,
    message: `status ${status}`,
    config: { url: "/api/v1/misc/compress-pdf", ...config },
    response: { status, data, headers: { "x-siriso-access": code } },
  };
}

describe("engine paywall rejections", () => {
  let denied: string[];
  const onDenied = (e: Event) => denied.push(String((e as CustomEvent).detail));

  beforeEach(() => {
    hrefs.length = 0;
    denied = [];
    vi.mocked(alert).mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/compress",
        search: "",
        origin: "http://localhost:3000",
        get href() {
          return "http://localhost:3000/compress";
        },
        set href(v: string) {
          hrefs.push(v);
        },
      },
    });
    window.addEventListener(SIRISO_ACCESS_DENIED_EVENT, onDenied);
  });

  afterEach(() => {
    window.removeEventListener(SIRISO_ACCESS_DENIED_EVENT, onDenied);
    sessionStorage.clear();
  });

  it("re-checks the account instead of redirecting to Stirling's /login on 401", async () => {
    await expect(handleHttpError(denial(401, "login-required"))).resolves.toBe(
      true,
    );

    expect(hrefs).toEqual([]);
    expect(denied).toEqual(["login-required"]);
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "error",
        body: expect.stringContaining("masuk"),
      }),
    );
  });

  it("shows the engine's own message for a free account", async () => {
    await handleHttpError(
      denial(402, "pro-required", { message: "Aktifkan Paket Pro dulu." }),
    );

    expect(denied).toEqual(["pro-required"]);
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Aktifkan Paket Pro dulu." }),
    );
  });

  it("still re-checks but stays quiet when the caller handles errors itself", async () => {
    await handleHttpError(
      denial(503, "unavailable", {}, { suppressErrorToast: true }),
    );

    expect(denied).toEqual(["unavailable"]);
    expect(alert).not.toHaveBeenCalled();
  });
});
