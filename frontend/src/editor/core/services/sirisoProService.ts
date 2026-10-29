export interface SirisoProSubscription {
  id: string;
  customerName: string;
  customerEmail: string;
  licenseKey: string;
  plan: string;
  pricePaid: number;
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  downloadsCount: number;
}

export interface SirisoProUser {
  id: string;
  name: string;
  email: string;
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
const BACKOFFICE_BASE = "http://localhost:8000";

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
    proStatus: user.proStatus,
    customerName: user.name,
    customerEmail: user.email,
    expiresAt: user.proExpiresAt || undefined,
    desktopActivationCode: code,
    licenseKey: code,
    downloadsCount: user.downloadsCount || 0,
  };
}

export async function fetchSirisoAdsConfig(): Promise<SirisoAdsConfig> {
  try {
    const response = await fetch(`${BACKOFFICE_BASE}/api/siriso-pdf/config`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return DEFAULT_ADS_CONFIG;
    const data = await response.json();
    const rawAds = data.ads || {};
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
      priceFormatted:
        data.pricing?.formattedPrice ??
        data.pricing?.formatted ??
        DEFAULT_ADS_CONFIG.priceFormatted,
      priceMonthly:
        data.pricing?.price ??
        data.pricing?.monthlyPrice ??
        DEFAULT_ADS_CONFIG.priceMonthly,
    };
  } catch {
    return DEFAULT_ADS_CONFIG;
  }
}

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
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      },
    );
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
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/auth/register`,
      {
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
      },
    );
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

export async function fetchSirisoAccountMe(token: string): Promise<{
  success: boolean;
  user?: SirisoProUser;
}> {
  if (!token) return { success: false };
  try {
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/auth/me?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const data = await response.json();
    if (response.ok && data.ok && data.user) {
      return { success: true, user: data.user };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

export async function requestSirisoProUpgrade(token: string): Promise<{
  success: boolean;
  message: string;
  user?: SirisoProUser;
}> {
  try {
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/auth/request-upgrade`,
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
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/payment/create-qris`,
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
        order: data.order,
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
    const params = new URLSearchParams({ token });
    if (orderId) params.set("orderId", orderId);
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/payment/status?${params.toString()}`,
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
        order: data.order ?? null,
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
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/payment/confirm-qris`,
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
        order: data.order,
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
    const response = await fetch(
      `${BACKOFFICE_BASE}/api/siriso-pdf/verify-desktop-code`,
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
            pricePaid: data.price || 25000,
            status: "active",
            expiresAt:
              data.expiresAt ||
              new Date(Date.now() + 30 * 86400000).toISOString(),
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
      message: "Tidak dapat menghubungi layanan verifikasi Siriso.",
    };
  }
}

export function getSirisoDesktopDownloadUrl(
  licenseKey?: string,
  authToken?: string,
): string {
  const params = new URLSearchParams();
  if (licenseKey) params.set("key", licenseKey);
  if (authToken) params.set("token", authToken);
  const query = params.toString();
  return `${BACKOFFICE_BASE}/api/siriso-pdf/download-desktop${query ? `?${query}` : ""}`;
}
