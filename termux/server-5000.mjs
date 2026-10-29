import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";
const BACKOFFICE_UPSTREAM_PORT = Number(process.env.BACKOFFICE_PORT || 8000);
const JAVA_UPSTREAM_PORT = Number(process.env.JAVA_BACKEND_PORT || 8080);

const PUBLIC_DIR = fs.existsSync(path.join(REPO_ROOT, "frontend", "dist", "index.html"))
  ? path.join(REPO_ROOT, "frontend", "dist")
  : path.join(__dirname, "public");

const ARCHIVE_FILE = path.join(__dirname, "siriso-web-dist.tar.gz");
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads", "qris");

function resolveDefaultDataFile() {
  if (process.env.SIRISO_DATA_FILE && fs.existsSync(process.env.SIRISO_DATA_FILE)) {
    return process.env.SIRISO_DATA_FILE;
  }
  const candidates = [
    path.resolve(REPO_ROOT, "..", "siriso", "data", "siriso-pdf.json"),
    path.resolve(REPO_ROOT, "..", "siriso", "data", "siriso-pdf-ads.json"),
    path.join(DATA_DIR, "siriso-pdf.json"),
    path.join(DATA_DIR, "siriso-pdf-ads.json"),
    process.env.HOME
      ? path.join(process.env.HOME, "siriso", "data", "siriso-pdf.json")
      : "",
    process.env.HOME
      ? path.join(process.env.HOME, "siriso", "data", "siriso-pdf-ads.json")
      : "",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return path.join(DATA_DIR, "siriso-pdf.json");
}

const DATA_FILE = resolveDefaultDataFile();

function ensureWebBundleExtracted() {
  const indexHtml = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexHtml)) {
    return;
  }
  if (!fs.existsSync(ARCHIVE_FILE)) {
    console.error("[Siriso Termux] Bundle web tidak ditemukan:", ARCHIVE_FILE);
    return;
  }
  console.log("[Siriso Termux] Mengekstrak bundle web produksi ke termux/public ...");
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  execFileSync("tar", ["-xzf", ARCHIVE_FILE, "-C", PUBLIC_DIR], {
    stdio: "inherit",
  });
  console.log("[Siriso Termux] Ekstraksi selesai.");
}

ensureWebBundleExtracted();
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".toml": "application/toml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".icc": "application/octet-stream",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, X-Webhook-Secret",
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const TOKEN_SECRETS = [
  "siriso-pdf-customer-secret-2026",
  "3a850c0f06b6bffdb6d14976051c7774",
  "siriso_pdf_token_secret_2026",
];

function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyUserPassword(rawPw, rec) {
  if (!rec) return false;
  if (typeof rec === "object" && rec.salt && rec.hash) {
    try {
      const test = crypto.scryptSync(String(rawPw), rec.salt, 64);
      const known = Buffer.from(rec.hash, "hex");
      return known.length === test.length && crypto.timingSafeEqual(known, test);
    } catch {
      return false;
    }
  }
  if (typeof rec === "string") {
    const testHash = crypto
      .createHash("sha256")
      .update(String(rawPw) + "::siriso_pdf_salt_2026")
      .digest("hex");
    return testHash === rec;
  }
  return false;
}

function createAuthToken(userId, email) {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      email,
      iat: Date.now(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", TOKEN_SECRETS[0])
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  let valid = false;
  for (const sec of TOKEN_SECRETS) {
    const expected = crypto
      .createHmac("sha256", sec)
      .update(payload)
      .digest("base64url");
    if (sig === expected) {
      valid = true;
      break;
    }
  }
  if (!valid) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.exp && decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function generateDesktopCode() {
  const r1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const r2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `SRP-DESK-${r1}-${r2}`;
}

function crc16Ccitt(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildDynamicQrisPayload(staticPayload, amount) {
  const raw = String(staticPayload || "").trim();
  const amtStr = String(Math.round(Number(amount) || 25000));
  const tag54 = "54" + String(amtStr.length).padStart(2, "0") + amtStr;
  if (!raw || !raw.startsWith("000201")) {
    const base =
      "00020101021226580014ID.CO.QRIS.WWW01189360091431234567890215ID2026SIRISOLAB0303UMI520458175303360" +
      tag54 +
      "5802ID5910SIRISO LAB6007JAKARTA6304";
    return base + crc16Ccitt(base);
  }
  let body = raw;
  const crcIdx = body.lastIndexOf("6304");
  if (crcIdx !== -1 && crcIdx >= body.length - 8) {
    body = body.slice(0, crcIdx);
  }
  body = body.replace(/^000201010211/, "000201010212");
  const ccyIdx = body.indexOf("5303360");
  if (ccyIdx !== -1) {
    const afterCcy = ccyIdx + 7;
    body = body.slice(0, afterCcy) + tag54 + body.slice(afterCcy);
  } else {
    body += tag54;
  }
  const withCrcTag = body + "6304";
  return withCrcTag + crc16Ccitt(withCrcTag);
}

async function readPdfStore() {
  let data = {};
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(await fsp.readFile(DATA_FILE, "utf8"));
    }
  } catch {
    data = {};
  }

  data.ads = data.ads || {
    enabled: true,
    globalHeadScript: "",
    bottomSticky: {
      enabled: false,
      format: "adsense",
      badge: "GOOGLE ADSENSE",
      title: "Google AdSense",
      adsenseClient: "",
      adsenseSlot: "",
    },
    rightSidebar: {
      enabled: false,
      format: "adsense",
      badge: "GOOGLE ADSENSE",
      title: "Google AdSense",
      adsenseClient: "",
      adsenseSlot: "",
    },
    floatingCorner: {
      enabled: false,
      format: "adsense",
      badge: "GOOGLE ADSENSE",
      title: "Google AdSense",
      adsenseClient: "",
      adsenseSlot: "",
    },
    topLeaderboard: {
      enabled: false,
      format: "adsense",
      badge: "GOOGLE ADSENSE",
      title: "Google AdSense",
      adsenseClient: "",
      adsenseSlot: "",
    },
  };
  data.pricing = data.pricing || {
    planName: "Siriso PDF Pro",
    monthlyPrice: 25000,
    currency: "IDR",
    formattedPrice: "Rp 25.000 / bulan",
  };
  data.users = Array.isArray(data.users) ? data.users : [];
  data.subscriptions = Array.isArray(data.subscriptions)
    ? data.subscriptions
    : [];
  data.payments = Array.isArray(data.payments) ? data.payments : [];
  data.stats = data.stats || { totalDownloads: 0 };
  data.qrisGateway = data.qrisGateway || {
    enabled: true,
    merchantName: "SIRISO LAB",
    nmid: "ID2026SIRISOLAB001",
    staticQrisPayload:
      "00020101021126580014ID.CO.QRIS.WWW01189360091431234567890215ID2026SIRISOLAB0303UMI5204581753033605802ID5910SIRISO LAB6007JAKARTA6304A1B2",
    customQrisImageUrl: "",
    useUniqueCode: true,
    autoApproveOnConfirm: false,
    webhookSecret: "siriso-qris-webhook-2026",
    instructions:
      "Scan kode QRIS di bawah menggunakan aplikasi BCA Mobile, Livin Mandiri, BRImo, BNI Mobile, GoPay, OVO, DANA, atau ShopeePay, lalu bayar sesuai nominal unik hingga 3 digit terakhir.",
  };

  if (!data.users.some((u) => u.email === "pro@siriso.com")) {
    data.users.unshift({
      id: "usr_demo_pro",
      name: "Pelanggan Demo Pro",
      email: "pro@siriso.com",
      passwordHash: hashPassword("pro12345"),
      proStatus: "active",
      proExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      desktopActivationCode: "SIRISO-PRO-2026-DEMO",
      downloadsCount: 1,
      createdAt: new Date().toISOString(),
    });
    await writePdfStore(data);
  }
  return data;
}

async function writePdfStore(data) {
  await fsp.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fsp.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function serializePdfUser(u) {
  const notExpired =
    !u.proExpiresAt || new Date(u.proExpiresAt) > new Date();
  const isPro = u.proStatus === "active" && notExpired;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    proStatus: isPro
      ? "active"
      : u.proStatus === "pending"
        ? "pending"
        : "free",
    isPro,
    proExpiresAt: u.proExpiresAt || null,
    desktopActivationCode: isPro ? u.desktopActivationCode || null : null,
    downloadsCount: u.downloadsCount || 0,
    upgradeRequestedAt: u.upgradeRequestedAt || null,
    createdAt: u.createdAt,
  };
}

function tryProxyRequest(req, res, targetPort) {
  return new Promise((resolve) => {
    if (targetPort === PORT) {
      resolve(false);
      return;
    }
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${targetPort}`,
        },
        timeout: 1200,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
        resolve(true);
      },
    );
    proxyReq.on("error", () => resolve(false));
    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      resolve(false);
    });
    if (req.method === "GET" || req.method === "HEAD") {
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  });
}

async function handleSirisoPdfApi(req, res, urlObj) {
  const pathname = urlObj.pathname;
  const method = req.method || "GET";

  // If GET request and separate Backoffice server is running on port 8000, proxy to it
  if ((method === "GET" || method === "HEAD") && BACKOFFICE_UPSTREAM_PORT !== PORT) {
    const proxied = await tryProxyRequest(req, res, BACKOFFICE_UPSTREAM_PORT);
    if (proxied) return;
  }

  const data = await readPdfStore();

  if (pathname === "/api/siriso-pdf/config" && method === "GET") {
    return sendJson(res, 200, {
      ads: data.ads,
      pricing: data.pricing,
      qrisGateway: {
        enabled: data.qrisGateway.enabled !== false,
        merchantName: data.qrisGateway.merchantName || "SIRISO LAB",
        nmid: data.qrisGateway.nmid || "ID2026SIRISOLAB001",
        customQrisImageUrl: data.qrisGateway.customQrisImageUrl || "",
        instructions: data.qrisGateway.instructions || "",
      },
    });
  }

  if (pathname === "/api/siriso-pdf/auth/register" && method === "POST") {
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name || !email || !email.includes("@")) {
      return sendJson(res, 400, {
        ok: false,
        error: "Nama dan email valid wajib diisi.",
      });
    }
    if (password.length < 6) {
      return sendJson(res, 400, {
        ok: false,
        error: "Kata sandi minimal 6 karakter.",
      });
    }
    if (data.users.some((u) => String(u.email).toLowerCase() === email)) {
      return sendJson(res, 409, {
        ok: false,
        error: "Email sudah terdaftar. Silakan masuk menggunakan akun Anda.",
      });
    }
    const newUser = {
      id: "usr_" + Date.now().toString(36),
      name,
      email,
      passwordHash: hashPassword(password),
      proStatus: "free",
      proExpiresAt: null,
      desktopActivationCode: null,
      downloadsCount: 0,
      createdAt: new Date().toISOString(),
    };
    data.users.unshift(newUser);
    await writePdfStore(data);
    const token = createAuthToken(newUser.id, newUser.email);
    return sendJson(res, 200, {
      ok: true,
      token,
      user: serializePdfUser(newUser),
    });
  }

  if (pathname === "/api/siriso-pdf/auth/login" && method === "POST") {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = data.users.find(
      (u) => String(u.email).toLowerCase() === email,
    );
    if (!user || !verifyUserPassword(password, user.passwordHash)) {
      return sendJson(res, 401, {
        ok: false,
        error: "Email atau kata sandi tidak sesuai.",
      });
    }
    const token = createAuthToken(user.id, user.email);
    return sendJson(res, 200, {
      ok: true,
      token,
      user: serializePdfUser(user),
    });
  }

  if (pathname === "/api/siriso-pdf/auth/me" && method === "GET") {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : urlObj.searchParams.get("token") || "";
    const claims = verifyAuthToken(token);
    if (!claims) {
      return sendJson(res, 401, { ok: false, error: "Sesi tidak valid." });
    }
    const user = data.users.find(
      (u) => u.id === claims.uid || u.email === claims.email,
    );
    if (!user) {
      return sendJson(res, 404, { ok: false, error: "Akun tidak ditemukan." });
    }
    return sendJson(res, 200, { ok: true, user: serializePdfUser(user) });
  }

  if (pathname === "/api/siriso-pdf/payment/create-qris" && method === "POST") {
    const body = await readJsonBody(req);
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : String(body.token || "");
    const claims = verifyAuthToken(token);
    if (!claims) {
      return sendJson(res, 401, {
        ok: false,
        error: "Silakan masuk ke akun Anda terlebih dahulu.",
      });
    }
    const user = data.users.find(
      (u) => u.id === claims.uid || u.email === claims.email,
    );
    if (!user) {
      return sendJson(res, 404, { ok: false, error: "Akun tidak ditemukan." });
    }

    const nowMs = Date.now();
    const forceNew = Boolean(body.forceNew);
    let existing = !forceNew
      ? data.payments.find(
          (p) =>
            p.userId === user.id &&
            (p.status === "pending" || p.status === "waiting_verification") &&
            new Date(p.expiresAt).getTime() > nowMs,
        )
      : null;

    if (!existing) {
      const baseAmount = Number(data.pricing?.monthlyPrice || 25000);
      const uniqueCode =
        data.qrisGateway.useUniqueCode !== false
          ? Math.floor(101 + Math.random() * 898)
          : 0;
      const totalAmount = baseAmount + uniqueCode;
      const orderId =
        "QRIS-" +
        new Date().toISOString().slice(0, 10).replace(/-/g, "") +
        "-" +
        crypto.randomBytes(2).toString("hex").toUpperCase();
      const qrisPayload = buildDynamicQrisPayload(
        data.qrisGateway.staticQrisPayload,
        totalAmount,
      );

      existing = {
        orderId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        planName: data.pricing?.planName || "Siriso PDF Pro (30 Hari)",
        planDays: 30,
        baseAmount,
        uniqueCode,
        totalAmount,
        formattedTotal: "Rp " + Number(totalAmount).toLocaleString("id-ID"),
        merchantName: data.qrisGateway.merchantName || "SIRISO LAB",
        nmid: data.qrisGateway.nmid || "ID2026SIRISOLAB001",
        qrisPayload,
        qrisImageUrl: data.qrisGateway.customQrisImageUrl || "",
        instructions: data.qrisGateway.instructions || "",
        status: "pending",
        createdAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
        confirmedAt: null,
        paidAt: null,
      };
      data.payments.unshift(existing);
      await writePdfStore(data);
    }

    return sendJson(res, 200, {
      ok: true,
      order: existing,
      user: serializePdfUser(user),
    });
  }

  if (pathname === "/api/siriso-pdf/payment/status" && method === "GET") {
    const orderId = urlObj.searchParams.get("orderId") || "";
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : urlObj.searchParams.get("token") || "";
    const claims = verifyAuthToken(token);
    if (!claims) {
      return sendJson(res, 401, { ok: false, error: "Sesi tidak valid." });
    }
    const user = data.users.find(
      (u) => u.id === claims.uid || u.email === claims.email,
    );
    if (!user) {
      return sendJson(res, 404, { ok: false, error: "Akun tidak ditemukan." });
    }
    const order = orderId
      ? data.payments.find(
          (p) => p.orderId === orderId && p.userId === user.id,
        )
      : data.payments.find((p) => p.userId === user.id);

    return sendJson(res, 200, {
      ok: true,
      order: order || null,
      user: serializePdfUser(user),
    });
  }

  if (pathname === "/api/siriso-pdf/payment/confirm-qris" && method === "POST") {
    const body = await readJsonBody(req);
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : String(body.token || "");
    const claims = verifyAuthToken(token);
    if (!claims) {
      return sendJson(res, 401, { ok: false, error: "Sesi tidak valid." });
    }
    const user = data.users.find(
      (u) => u.id === claims.uid || u.email === claims.email,
    );
    const order = data.payments.find(
      (p) => p.orderId === body.orderId && user && p.userId === user.id,
    );
    if (!user || !order) {
      return sendJson(res, 404, {
        ok: false,
        error: "Tagihan QRIS tidak ditemukan.",
      });
    }
    order.confirmedAt = new Date().toISOString();
    order.payerNote = String(body.payerNote || "").trim();

    if (data.qrisGateway.autoApproveOnConfirm) {
      order.status = "paid";
      order.paidAt = new Date().toISOString();
      user.proStatus = "active";
      user.proExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      if (!user.desktopActivationCode) {
        user.desktopActivationCode = generateDesktopCode();
      }
    } else {
      order.status = "waiting_verification";
      if (user.proStatus !== "active") {
        user.proStatus = "pending";
      }
    }
    await writePdfStore(data);
    return sendJson(res, 200, {
      ok: true,
      order,
      user: serializePdfUser(user),
      message:
        order.status === "paid"
          ? "Pembayaran QRIS terverifikasi otomatis! Paket Pro Anda telah aktif."
          : "Konfirmasi pembayaran QRIS diterima dan sedang diverifikasi.",
    });
  }

  if (
    (pathname === "/api/siriso-pdf/verify-desktop-code" ||
      pathname === "/api/siriso-pdf/verify-pro") &&
    method === "POST"
  ) {
    const body = await readJsonBody(req);
    const code = String(body.activationCode || body.licenseKey || "")
      .trim()
      .toUpperCase();
    const matchedUser = data.users.find(
      (u) =>
        String(u.desktopActivationCode || "").toUpperCase() === code &&
        u.proStatus === "active",
    );
    if (matchedUser) {
      return sendJson(res, 200, {
        valid: true,
        subscription: {
          id: matchedUser.id,
          customerName: matchedUser.name,
          customerEmail: matchedUser.email,
          licenseKey: matchedUser.desktopActivationCode,
          plan: "Paket Pro (Desktop Offline)",
          pricePaid: 25000,
          status: "active",
          expiresAt: matchedUser.proExpiresAt,
          downloadsCount: matchedUser.downloadsCount || 0,
        },
        user: serializePdfUser(matchedUser),
      });
    }

    const matchedSub = (data.subscriptions || []).find(
      (s) =>
        String(s.licenseKey || "").toUpperCase() === code &&
        s.status === "active",
    );
    if (matchedSub) {
      return sendJson(res, 200, {
        valid: true,
        subscription: {
          id: matchedSub.id,
          customerName: matchedSub.name,
          customerEmail: matchedSub.email,
          licenseKey: matchedSub.licenseKey,
          plan: matchedSub.plan || "Paket Pro",
          pricePaid: matchedSub.price || 25000,
          status: "active",
          expiresAt: matchedSub.expiresAt,
          downloadsCount: matchedSub.downloadsCount || 0,
        },
      });
    }

    return sendJson(res, 200, {
      valid: false,
      error: "Kode aktivasi desktop tidak ditemukan atau belum aktif.",
    });
  }

  return sendJson(res, 404, { ok: false, error: "Endpoint tidak ditemukan." });
}

async function handleAppV1Api(req, res, urlObj) {
  const pathname = urlObj.pathname;

  if (JAVA_UPSTREAM_PORT !== PORT) {
    const proxied = await tryProxyRequest(req, res, JAVA_UPSTREAM_PORT);
    if (proxied) return;
  }

  if (pathname === "/api/v1/config/app-config") {
    return sendJson(res, 200, {
      baseUrl: "",
      contextPath: "",
      serverPort: PORT,
      appNameNavbar: "Siriso PDF",
      homeText: "Siriso PDF Studio",
      homeDescription: "Platform PDF Studio Modern",
      version: "3.2.2",
      enableLogin: false,
      securityEnabled: false,
      runningProOrHigher: true,
      runningEE: false,
      license: "PRO",
      languages: ["id_ID", "en_GB", "en_US"],
      defaultLocale: "id-ID",
      enableAnalytics: false,
      allowFileUpload: true,
      disabledEndpoints: [],
      endpointGroups: {},
    });
  }

  if (pathname === "/api/v1/info/status" || pathname === "/api/v1/info/uptime") {
    return sendJson(res, 200, {
      status: "UP",
      version: "3.2.2-termux",
      uptime: Math.floor(process.uptime()),
    });
  }

  return sendJson(res, 503, {
    error: "Operasi server Java tidak aktif pada mode ringan Termux.",
  });
}

async function serveStaticFile(req, res, urlObj) {
  let reqPath = decodeURIComponent(urlObj.pathname);
  if (reqPath === "/" || reqPath === "/welcome") {
    reqPath = "/index.html";
  }

  const safePath = path
    .normalize(reqPath)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");

  let filePath = path.join(PUBLIC_DIR, safePath);

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    const ext = path.extname(safePath);
    if (!ext) {
      filePath = path.join(PUBLIC_DIR, "index.html");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const cacheControl =
      ext === ".html" ? "no-cache" : "public, max-age=86400";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 Internal Server Error");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Requested-With, X-Webhook-Secret",
      });
      res.end();
      return;
    }

    const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (urlObj.pathname.startsWith("/api/siriso-pdf/")) {
      await handleSirisoPdfApi(req, res, urlObj);
      return;
    }

    if (urlObj.pathname.startsWith("/api/v1/")) {
      await handleAppV1Api(req, res, urlObj);
      return;
    }

    await serveStaticFile(req, res, urlObj);
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : "Internal Server Error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log("=========================================================");
  console.log("  SIRISO PDF STUDIO - ANDROID TERMUX SERVER (PORT " + PORT + ")");
  console.log("=========================================================");
  console.log("  Local URL   : http://localhost:" + PORT);
  console.log("  Network URL : http://" + HOST + ":" + PORT);
  console.log("  Static Root : " + PUBLIC_DIR);
  console.log("  Data Store  : " + DATA_FILE);
  console.log("=========================================================");
});
