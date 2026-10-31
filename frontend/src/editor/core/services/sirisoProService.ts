export interface SirisoProSubscription {
  id: string;
  customerName: string;
  customerEmail: string;
  licenseKey: string;
  plan: string;
  pricePaid: number;
  status: "active" | "expired" | "revoked";
  expiresAt: string | null;
  downloadsCount: number;
}

/** Account role managed from the Siriso backoffice. */
export type SirisoRole = "user" | "staff" | "admin";

/** What an account may do in the PDF app (computed by the server, mirrored by computeAccess). */
export interface SirisoAccess {
  workspace: boolean;
  adFree: boolean;
  desktop: boolean;
  admin: boolean;
}

/** Who may open the workspace, set from the backoffice "Harga & Akses" page. */
export interface SirisoAccessPolicy {
  workspaceRequiresPro: boolean;
}

export interface SirisoFreePlan {
  name: string;
  priceLabel: string;
  periodLabel: string;
  description: string;
  ctaLabel: string;
  features: string[];
}

/** Paket Pro as configured in the backoffice: billed through QRIS and shown on the landing page. */
export interface SirisoPricing {
  name: string;
  price: number;
  compareAtPrice: number;
  period: string;
  planDays: number;
  formattedPrice: string;
  formattedCompareAt: string;
  badge: string;
  tagline: string;
  promoLabel: string;
  description: string;
  ctaLabel: string;
  features: string[];
  free: SirisoFreePlan;
}

export interface SirisoProUser {
  id: string;
  name: string;
  email: string;
  role?: SirisoRole;
  access?: SirisoAccess;
  isPro: boolean;
  proStatus: "free" | "pending" | "active" | "expired";
  proExpiresAt?: string | null;
  desktopActivationCode?: string | null;
  downloadsCount?: number;
  upgradeRequestedAt?: string | null;
  createdAt?: string;
}

export interface SirisoQrisOrder {
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planDays: number;
  baseAmount: number;
  uniqueCode: number;
  totalAmount: number;
  formattedTotal: string;
  merchantName: string;
  merchantCity?: string;
  nmid: string;
  qrisImageUrl?: string;
  qrisPayload: string;
  supportedApps?: string;
  status: "pending" | "waiting_verification" | "paid" | "expired";
  payerNote?: string;
  createdAt: string;
  expiresAt: string;
  paidAt?: string | null;
}

export interface SirisoProState {
  isPro: boolean;
  authToken?: string;
  userId?: string;
  role?: SirisoRole;
  proStatus?: "free" | "pending" | "active" | "expired";
  licenseKey?: string;
  desktopActivationCode?: string;
  customerName?: string;
  customerEmail?: string;
  expiresAt?: string;
  downloadsCount?: number;
}

export type AdSlotFormat = "banner" | "adsense" | "html" | "script";

export interface SirisoAdSlotConfig {
  enabled: boolean;
  format: AdSlotFormat;
  badge?: string;
  title?: string;
  bannerImageUrl?: string;
  bannerTargetUrl?: string;
  adsenseClient?: string;
  adsenseSlot?: string;
  htmlCode?: string;
  width?: number | string;
  height?: number | string;
}

export interface SirisoAdsConfig {
  enabled: boolean;
  globalHeadScript?: string;
  bottomSticky: SirisoAdSlotConfig;
  rightSidebar?: SirisoAdSlotConfig;
  floatingCorner?: SirisoAdSlotConfig;
  topLeaderboard?: SirisoAdSlotConfig;
  text: string;
  badgeText: string;
  actionText: string;
  actionUrl: string;
  position: string;
  priceFormatted: string;
  priceMonthly: number;
}

const STORAGE_KEY = "siriso_pro_auth_v1";
/** Exported so other tabs can follow sign-in / sign-out through the storage event. */
export const SIRISO_AUTH_STORAGE_KEY = STORAGE_KEY;
const PUBLIC_CONFIG_KEY = "siriso_public_config_v1";

let cachedBackofficeBase: string | null = null;

/** A page served from this machine or the LAN (dev / Termux) — the only case where probing :8000 makes sense. */
function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    /^(10|192\.168)\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Where the Siriso backoffice API lives. VITE_SIRISO_API_BASE pins it for a deployment;
 * otherwise the page's own origin (reverse proxy) is tried, then a backoffice on :8000 when
 * running locally, then sirisolab.com. Public visitors never get probes to localhost.
 */
function getBackofficeCandidates(): string[] {
  const host = globalThis.location?.hostname || "localhost";
  const protocol = globalThis.location?.protocol || "http:";
  const origin = globalThis.location?.origin || "http://localhost:5000";
  const configured = String(import.meta.env.VITE_SIRISO_API_BASE || "")
    .trim()
    .replace(/\/+$/, "");
  const candidates: string[] = [];

  if (configured) return [configured];
  if (cachedBackofficeBase !== null) candidates.push(cachedBackofficeBase);
  candidates.push(origin);
  if (isLocalHost(host)) {
    if (protocol === "http:") candidates.push(`http://${host}:8000`);
    candidates.push("http://localhost:8000");
  }
  candidates.push("https://sirisolab.com");

  return Array.from(new Set(candidates));
}

async function fetchSirisoApi(
  apiPath: string,
  init?: RequestInit,
): Promise<Response> {
  const candidates = getBackofficeCandidates();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${apiPath}`, init);
      const contentType = response.headers.get("content-type") || "";
      if (
        response.status !== 404 &&
        response.status !== 502 &&
        contentType.includes("application/json")
      ) {
        cachedBackofficeBase = base;
        return response;
      }
      lastResponse = response;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError ?? new Error("Unable to reach Siriso API");
}

function getActiveBackofficeBase(): string {
  if (cachedBackofficeBase !== null) return cachedBackofficeBase;
  return getBackofficeCandidates()[0];
}

export const DEFAULT_ADS_CONFIG: SirisoAdsConfig = {
  enabled: true,
  globalHeadScript: "",
  bottomSticky: {
    enabled: false,
    format: "adsense",
    badge: "GOOGLE ADSENSE",
    title: "Google AdSense",
    bannerImageUrl: "",
    bannerTargetUrl: "",
    adsenseClient: "",
    adsenseSlot: "",
    htmlCode: "",
  },
  rightSidebar: {
    enabled: false,
    format: "adsense",
    badge: "GOOGLE ADSENSE",
    title: "Google AdSense",
    bannerImageUrl: "",
    bannerTargetUrl: "",
    adsenseClient: "",
    adsenseSlot: "",
    htmlCode: "",
  },
  floatingCorner: {
    enabled: false,
    format: "adsense",
    badge: "GOOGLE ADSENSE",
    title: "Google AdSense",
    bannerImageUrl: "",
    bannerTargetUrl: "",
    adsenseClient: "",
    adsenseSlot: "",
    htmlCode: "",
  },
  topLeaderboard: {
    enabled: false,
    format: "adsense",
    badge: "GOOGLE ADSENSE",
    title: "Google AdSense",
    bannerImageUrl: "",
    bannerTargetUrl: "",
    adsenseClient: "",
    adsenseSlot: "",
    htmlCode: "",
  },
  text: "Gunakan Siriso Pro untuk bebas iklan dan download Siriso PDF Desktop Windows!",
  badgeText: "PAKET PRO",
  actionText: "Upgrade Rp 25.000 / bln",
  actionUrl: "https://sirisolab.com",
  position: "bottom",
  priceFormatted: "Rp 25.000 / bulan",
  priceMonthly: 25000,
};

export const DEFAULT_PRICING: SirisoPricing = {
  name: "Paket Pro",
  price: 25000,
  compareAtPrice: 0,
  period: "bulan",
  planDays: 30,
  formattedPrice: "Rp 25.000 / bulan",
  formattedCompareAt: "",
  badge: "SIRISO PDF PAKET PRO",
  tagline: "BEBAS IKLAN + DESKTOP WINDOWS",
  promoLabel: "",
  description:
    "Kerja dokumen PDF tanpa iklan sekaligus akses aplikasi Siriso PDF Desktop untuk Windows.",
  ctaLabel: "Upgrade ke Paket Pro",
  features: [
    "100% bebas iklan di seluruh Workspace web",
    "Unduh Siriso PDF Desktop (Windows x64) + kode aktivasi offline",
    "Siriso Office Convert, OCR multi-bahasa, tanda tangan sertifikat & otomatisasi",
    "Satu akun untuk web dan aplikasi desktop",
  ],
  free: {
    name: "Akses Web Standar",
    priceLabel: "Gratis",
    periodLabel: "/ selamanya di browser",
    description:
      "Untuk kebutuhan PDF harian langsung dari browser tanpa instalasi.",
    ctaLabel: "Mulai gratis",
    features: [
      "Alat PDF utama: gabung, pisah, kompres, putar, baca & anotasi",
      "Alur kerja multi-alat langsung di browser",
      "Cukup daftar akun gratis untuk membuka Workspace",
      "Didukung iklan resmi Google AdSense",
    ],
  },
};

export const DEFAULT_ACCESS_POLICY: SirisoAccessPolicy = {
  workspaceRequiresPro: true,
};

export interface SirisoPublicConfig {
  ads: SirisoAdsConfig;
  pricing: SirisoPricing;
  access: SirisoAccessPolicy;
}

/**
 * The client-side twin of the server's access rule. Tim/Admin roles get everything; customers
 * get the workspace with an active Pro plan, or with any account when the policy allows it.
 */
export function computeAccess(
  state: SirisoProState,
  policy: SirisoAccessPolicy,
): SirisoAccess {
  const privileged = state.role === "staff" || state.role === "admin";
  const loggedIn = Boolean(state.authToken || state.customerEmail);
  const isPro = Boolean(state.isPro);
  return {
    workspace:
      privileged || isPro || (!policy.workspaceRequiresPro && loggedIn),
    adFree: privileged || isPro,
    desktop: privileged || isPro,
    admin: state.role === "admin",
  };
}

const asText = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;
const asList = (v: unknown, fallback: string[]): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : fallback;

function normalizePricing(
  raw: Record<string, unknown> | undefined,
): SirisoPricing {
  const p = raw || {};
  const d = DEFAULT_PRICING;
  const price = Number(p.price);
  const compareAt = Number(p.compareAtPrice);
  const free = (p.free || {}) as Record<string, unknown>;
  const validPrice = Number.isFinite(price) && price > 0 ? price : d.price;
  const period = asText(p.period, d.period);
  return {
    name: asText(p.name, d.name),
    price: validPrice,
    compareAtPrice:
      Number.isFinite(compareAt) && compareAt > validPrice ? compareAt : 0,
    period,
    planDays: Number(p.planDays) > 0 ? Number(p.planDays) : d.planDays,
    formattedPrice: asText(
      p.formattedPrice,
      `Rp ${validPrice.toLocaleString("id-ID")} / ${period}`,
    ),
    formattedCompareAt: asText(p.formattedCompareAt, ""),
    badge: asText(p.badge, d.badge),
    tagline: asText(p.tagline, d.tagline),
    promoLabel: asText(p.promoLabel, ""),
    description: asText(p.description, d.description),
    ctaLabel: asText(p.ctaLabel, d.ctaLabel),
    features: asList(p.features, d.features),
    free: {
      name: asText(free.name, d.free.name),
      priceLabel: asText(free.priceLabel, d.free.priceLabel),
      periodLabel: asText(free.periodLabel, d.free.periodLabel),
      description: asText(free.description, d.free.description),
      ctaLabel: asText(free.ctaLabel, d.free.ctaLabel),
      features: asList(free.features, d.free.features),
    },
  };
}

/** Last config seen, so the landing page shows the real price before the network answers. */
export function getCachedPublicConfig(): SirisoPublicConfig | null {
  try {
    const raw = localStorage.getItem(PUBLIC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SirisoPublicConfig>;
    return {
      ads: DEFAULT_ADS_CONFIG,
      pricing: normalizePricing(
        parsed.pricing as unknown as Record<string, unknown>,
      ),
      access: {
        workspaceRequiresPro: parsed.access?.workspaceRequiresPro !== false,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Only allow official Google AdSense units with a valid publisher client ID
 * (`ca-pub-...`) and numeric ad unit slot ID. Non-Google placeholder banners
 * or incomplete slots are never rendered.
 */
export function isOfficialGoogleAdSlot(
  slot?: SirisoAdSlotConfig,
): slot is SirisoAdSlotConfig {
  if (!slot || slot.enabled === false) return false;
  if (slot.format !== "adsense") return false;
  const client = (slot.adsenseClient || "").trim();
  const slotId = (slot.adsenseSlot || "").trim();
  return (
    /^ca-pub-\d+$/.test(client) && slotId.length > 0 && /^\d+$/.test(slotId)
  );
}

export function getStoredProState(): SirisoProState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isPro: false };
    const parsed = JSON.parse(raw) as SirisoProState;
    if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) {
      return {
        ...parsed,
        isPro: false,
        proStatus: parsed.customerEmail ? "expired" : undefined,
      };
    }
    return parsed;
  } catch {
    return { isPro: false };
  }
}

export function saveStoredProState(state: SirisoProState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function clearStoredProState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function mapUserToProState(
  user: SirisoProUser,
  authToken?: string,
): SirisoProState {
  const code = user.desktopActivationCode || undefined;
  return {
    isPro: Boolean(user.isPro),
    authToken,
    userId: user.id,
    role: user.role === "staff" || user.role === "admin" ? user.role : "user",
    proStatus: user.proStatus,
    customerName: user.name,
    customerEmail: user.email,
    expiresAt: user.proExpiresAt || undefined,
    desktopActivationCode: code,
    licenseKey: code,
    downloadsCount: user.downloadsCount || 0,
  };
}

function normalizeQrisOrder(
  order?: SirisoQrisOrder | null,
): SirisoQrisOrder | undefined {
  if (!order) return undefined;
  if (
    order.qrisImageUrl &&
    order.qrisImageUrl.startsWith("http://localhost:8000/")
  ) {
    const activeBase = getActiveBackofficeBase();
    return {
      ...order,
      qrisImageUrl: order.qrisImageUrl.replace(
        "http://localhost:8000",
        activeBase,
      ),
    };
  }
  return order;
}

/** Public Siriso PDF config: ad slots, Paket Pro pricing and the workspace access policy. Null when unreachable. */
export async function fetchSirisoPublicConfig(): Promise<SirisoPublicConfig | null> {
  try {
    const response = await fetchSirisoApi("/api/siriso-pdf/config", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const pricing = normalizePricing(data.pricing);
    const access: SirisoAccessPolicy = {
      workspaceRequiresPro: data.access?.workspaceRequiresPro !== false,
    };
    try {
      localStorage.setItem(
        PUBLIC_CONFIG_KEY,
        JSON.stringify({ pricing, access }),
      );
    } catch {
      // storage is a convenience only
    }
    return { ads: parseAdsConfig(data, pricing), pricing, access };
  } catch {
    return null;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- raw JSON from the backoffice */
function parseAdsConfig(
  data: { ads?: Record<string, any> },
  pricing: SirisoPricing,
): SirisoAdsConfig {
  // Ad slots are rebuilt field by field so unexpected keys never reach the DOM.
  {
    const rawAds: Record<string, any> = data.ads || {};
    const rawSticky = rawAds.bottomSticky || {};
    const rawSidebar = rawAds.rightSidebar || {};
    const rawCorner = rawAds.floatingCorner || {};
    const rawLb = rawAds.topLeaderboard || {};

    return {
      enabled: rawAds.enabled ?? true,
      globalHeadScript: rawAds.globalHeadScript || "",
      bottomSticky: {
        enabled: rawSticky.enabled ?? false,
        format: rawSticky.format || "adsense",
        badge: rawSticky.badge || "GOOGLE ADSENSE",
        title: rawSticky.title || "Google AdSense",
        bannerImageUrl: "",
        bannerTargetUrl: "",
        adsenseClient: rawSticky.adsenseClient || "",
        adsenseSlot: rawSticky.adsenseSlot || "",
        htmlCode: "",
      },
      rightSidebar: {
        enabled: rawSidebar.enabled ?? false,
        format: rawSidebar.format || "adsense",
        badge: rawSidebar.badge || "GOOGLE ADSENSE",
        title: rawSidebar.title || "Google AdSense",
        bannerImageUrl: "",
        bannerTargetUrl: "",
        adsenseClient: rawSidebar.adsenseClient || "",
        adsenseSlot: rawSidebar.adsenseSlot || "",
        htmlCode: "",
      },
      floatingCorner: {
        enabled: rawCorner.enabled ?? false,
        format: rawCorner.format || "adsense",
        badge: rawCorner.badge || "GOOGLE ADSENSE",
        title: rawCorner.title || "Google AdSense",
        bannerImageUrl: "",
        bannerTargetUrl: "",
        adsenseClient: rawCorner.adsenseClient || "",
        adsenseSlot: rawCorner.adsenseSlot || "",
        htmlCode: "",
      },
      topLeaderboard: {
        enabled: rawLb.enabled ?? false,
        format: rawLb.format || "adsense",
        badge: rawLb.badge || "GOOGLE ADSENSE",
        title: rawLb.title || "Google AdSense",
        bannerImageUrl: "",
        bannerTargetUrl: "",
        adsenseClient: rawLb.adsenseClient || "",
        adsenseSlot: rawLb.adsenseSlot || "",
        htmlCode: "",
      },
      text: rawAds.text ?? DEFAULT_ADS_CONFIG.text,
      badgeText: rawAds.badgeText ?? DEFAULT_ADS_CONFIG.badgeText,
      actionText:
        rawAds.ctaText ?? rawAds.actionText ?? DEFAULT_ADS_CONFIG.actionText,
      actionUrl:
        rawAds.linkUrl ?? rawAds.actionUrl ?? DEFAULT_ADS_CONFIG.actionUrl,
      position: rawAds.position ?? "bottom",
      priceFormatted: pricing.formattedPrice,
      priceMonthly: pricing.price,
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loginSirisoAccount(
  email: string,
  password: string,
): Promise<{
  success: boolean;
  message: string;
  token?: string;
  user?: SirisoProUser;
}> {
  try {
    const response = await fetchSirisoApi("/api/siriso-pdf/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await response.json();
    if (response.ok && data.ok && data.user) {
      return {
        success: true,
        message: data.message || "Berhasil masuk ke akun Siriso PDF.",
        token: data.token,
        user: data.user,
      };
    }
    return {
      success: false,
      message: data.error || "Email atau kata sandi tidak sesuai.",
    };
  } catch {
    return {
      success: false,
      message: "Tidak dapat terhubung ke layanan autentikasi Siriso.",
    };
  }
}

export async function registerSirisoAccount(
  name: string,
  email: string,
  password: string,
): Promise<{
  success: boolean;
  message: string;
  token?: string;
  user?: SirisoProUser;
}> {
  try {
    const response = await fetchSirisoApi("/api/siriso-pdf/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    });
    const data = await response.json();
    if (response.ok && data.ok && data.user) {
      return {
        success: true,
        message: data.message || "Akun berhasil dibuat!",
        token: data.token,
        user: data.user,
      };
    }
    return {
      success: false,
      message: data.error || "Gagal mendaftarkan akun baru.",
    };
  } catch {
    return {
      success: false,
      message: "Tidak dapat terhubung ke layanan autentikasi Siriso.",
    };
  }
}

/**
 * `invalid` means the server rejected the session (expired/forged token, deleted account) and it
 * must be dropped; a network failure leaves `invalid` false so a temporary outage does not sign
 * anyone out.
 */
export async function fetchSirisoAccountMe(token: string): Promise<{
  success: boolean;
  invalid: boolean;
  user?: SirisoProUser;
}> {
  if (!token) return { success: false, invalid: true };
  try {
    const response = await fetchSirisoApi("/api/siriso-pdf/auth/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      return { success: false, invalid: true };
    }
    const data = await response.json();
    if (response.ok && data.ok && data.user) {
      return { success: true, invalid: false, user: data.user };
    }
    return { success: false, invalid: false };
  } catch {
    return { success: false, invalid: false };
  }
}

export async function requestSirisoProUpgrade(token: string): Promise<{
  success: boolean;
  message: string;
  user?: SirisoProUser;
}> {
  try {
    const response = await fetchSirisoApi(
      "/api/siriso-pdf/auth/request-upgrade",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      },
    );
    const data = await response.json();
    if (response.ok && data.ok) {
      return {
        success: true,
        message:
          data.message ||
          "Permintaan aktivasi Paket Pro telah dikirim untuk akun Anda.",
        user: data.user,
      };
    }
    return {
      success: false,
      message: data.error || "Gagal mengirim permintaan aktivasi Pro.",
    };
  } catch {
    return {
      success: false,
      message: "Tidak dapat menghubungi layanan Siriso.",
    };
  }
}

export async function createSirisoQrisPayment(
  token: string,
  forceNew = false,
): Promise<{
  success: boolean;
  message: string;
  order?: SirisoQrisOrder;
  user?: SirisoProUser;
}> {
  try {
    const response = await fetchSirisoApi(
      "/api/siriso-pdf/payment/create-qris",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token, planDays: 30, forceNew }),
      },
    );
    const data = await response.json();
    if (response.ok && data.ok && data.order) {
      return {
        success: true,
        message: "Tagihan QRIS berhasil dibuat.",
        order: normalizeQrisOrder(data.order),
        user: data.user,
      };
    }
    return {
      success: false,
      message: data.error || "Gagal membuat tagihan pembayaran QRIS.",
    };
  } catch {
    return {
      success: false,
      message: "Tidak dapat terhubung ke layanan Payment Gateway QRIS Siriso.",
    };
  }
}

export async function fetchSirisoQrisPaymentStatus(
  token: string,
  orderId?: string,
): Promise<{
  success: boolean;
  order?: SirisoQrisOrder | null;
  user?: SirisoProUser;
}> {
  if (!token) return { success: false };
  try {
    const params = new URLSearchParams();
    if (orderId) params.set("orderId", orderId);
    const query = params.toString();
    const response = await fetchSirisoApi(
      `/api/siriso-pdf/payment/status${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const data = await response.json();
    if (response.ok && data.ok) {
      return {
        success: true,
        order: normalizeQrisOrder(data.order) ?? null,
        user: data.user,
      };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

export async function confirmSirisoQrisPayment(
  token: string,
  orderId: string,
  payerNote?: string,
): Promise<{
  success: boolean;
  message: string;
  order?: SirisoQrisOrder;
  user?: SirisoProUser;
}> {
  try {
    const response = await fetchSirisoApi(
      "/api/siriso-pdf/payment/confirm-qris",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token,
          orderId,
          payerNote: (payerNote || "").trim(),
        }),
      },
    );
    const data = await response.json();
    if (response.ok && data.ok) {
      return {
        success: true,
        message:
          data.message ||
          "Konfirmasi pembayaran QRIS berhasil dikirim untuk diverifikasi.",
        order: normalizeQrisOrder(data.order),
        user: data.user,
      };
    }
    return {
      success: false,
      message: data.error || "Gagal mengirim konfirmasi pembayaran QRIS.",
    };
  } catch {
    return {
      success: false,
      message: "Tidak dapat menghubungi layanan Payment Gateway QRIS Siriso.",
    };
  }
}

export async function verifySirisoLicense(licenseKey: string): Promise<{
  success: boolean;
  message: string;
  /** True when the server could not be reached, as opposed to rejecting the code. */
  networkError?: boolean;
  subscription?: SirisoProSubscription;
}> {
  const cleanKey = (licenseKey || "").trim().toUpperCase();
  if (!cleanKey) {
    return {
      success: false,
      message: "Kode aktivasi desktop tidak boleh kosong.",
    };
  }

  try {
    const response = await fetchSirisoApi(
      "/api/siriso-pdf/verify-desktop-code",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ activationCode: cleanKey }),
      },
    );

    const data = await response.json();
    const sub: SirisoProSubscription | undefined =
      data.subscription ||
      (data.valid
        ? {
            id: data.id || "sub_active",
            customerName: data.name || data.customerName || "Pelanggan Pro",
            customerEmail: data.email || data.customerEmail || "",
            licenseKey: data.licenseKey || cleanKey,
            plan: data.plan || "Paket Pro (Desktop Offline)",
            pricePaid: data.price || 0,
            status: "active",
            // Never invent an expiry: null means the server granted open-ended access (Tim/Admin)
            expiresAt: data.expiresAt || null,
            downloadsCount: data.downloadsCount || 0,
          }
        : undefined);

    if (response.ok && data.valid && sub) {
      return {
        success: true,
        message: "Kode aktivasi aplikasi Desktop berhasil diverifikasi!",
        subscription: sub,
      };
    }
    return {
      success: false,
      message:
        data.error ||
        data.message ||
        "Kode aktivasi desktop tidak valid atau telah berakhir.",
    };
  } catch {
    return {
      success: false,
      networkError: true,
      message: "Tidak dapat menghubungi layanan verifikasi Siriso.",
    };
  }
}

/** The desktop code alone authorises the download, so the session token never ends up in a URL. */
export function getSirisoDesktopDownloadUrl(licenseKey?: string): string {
  const params = new URLSearchParams();
  if (licenseKey) params.set("key", licenseKey);
  const query = params.toString();
  return `${getActiveBackofficeBase()}/api/siriso-pdf/download-desktop${query ? `?${query}` : ""}`;
}
