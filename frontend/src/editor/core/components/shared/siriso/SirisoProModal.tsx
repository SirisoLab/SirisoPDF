import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { getSirisoDesktopDownloadUrl } from "@editor/services/sirisoProService";
import "@editor/components/shared/siriso/SirisoProModal.css";

function getInitials(name?: string, email?: string): string {
  const src = (name || email || "S").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  staff: "Tim Siriso",
  admin: "Admin",
};

function AccountCard({
  name,
  email,
  nameFallback,
  emailFallback,
  pro = false,
  badge,
}: {
  name?: string;
  email?: string;
  nameFallback: string;
  emailFallback?: string;
  pro?: boolean;
  badge: ReactNode;
}) {
  return (
    <div
      className={`siriso-pm-user-card${pro ? " siriso-pm-user-card--pro" : ""}`}
    >
      <div className="siriso-pm-user-info">
        <div className="siriso-pm-avatar">{getInitials(name, email)}</div>
        <div>
          <p className="siriso-pm-user-name">{name || nameFallback}</p>
          <p className="siriso-pm-user-email">{email || emailFallback}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

function AdFreeAccessNote({
  isPro,
  planName,
  roleLabel,
  expiresAt,
}: {
  isPro: boolean;
  planName: string;
  roleLabel?: string;
  expiresAt?: string | null;
}) {
  return (
    <p className="siriso-pm-panel-desc">
      {isPro ? (
        <>
          Akun Anda sudah berstatus <strong>{planName}</strong>.
        </>
      ) : (
        <>
          Akun Anda ber-role <strong>{roleLabel}</strong> dari backoffice
          Siriso, jadi seluruh fitur terbuka tanpa langganan.
        </>
      )}{" "}
      Seluruh slot iklan di Workspace Web dinonaktifkan secara otomatis.
      {isPro && expiresAt && (
        <>
          {" "}
          Masa aktif berlaku hingga{" "}
          <strong>
            {new Date(expiresAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
          .
        </>
      )}
    </p>
  );
}

function DesktopCodeBox({
  code,
  copied,
  onCopy,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="siriso-pm-code-box">
      <code
        className="siriso-pm-code-value"
        data-testid="siriso-desktop-offline-code"
      >
        {code}
      </code>
      <button
        type="button"
        className="siriso-pm-btn siriso-pm-btn-secondary siriso-pm-btn-sm"
        onClick={onCopy}
      >
        <Icon name="copy" size="0.9rem" />
        <span>{copied ? "Tersalin!" : "Salin Kode"}</span>
      </button>
    </div>
  );
}

function AdFreeAccountActions({
  isChecking,
  onEnterWorkspace,
  onRefresh,
  onLogout,
}: {
  isChecking: boolean;
  onEnterWorkspace: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.6rem",
      }}
    >
      <button
        type="button"
        className="siriso-pm-btn siriso-pm-btn-secondary siriso-pm-btn-sm"
        onClick={onEnterWorkspace}
        data-testid="siriso-modal-enter-workspace-btn"
      >
        <Icon name="layout-grid" size="0.9rem" />
        <span>Buka Workspace PDF</span>
      </button>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          className="siriso-pm-btn siriso-pm-btn-secondary siriso-pm-btn-sm"
          onClick={onRefresh}
          disabled={isChecking}
        >
          <Icon name="refresh-cw" size="0.9rem" />
          <span>Segarkan</span>
        </button>
        <button
          type="button"
          className="siriso-pm-btn siriso-pm-btn-secondary siriso-pm-btn-sm"
          onClick={onLogout}
          data-testid="siriso-logout-btn"
        >
          <Icon name="log-out" size="0.9rem" />
          <span>Keluar Akun</span>
        </button>
      </div>
    </div>
  );
}

function WorkspaceLockedBanner({
  planName,
  formattedPrice,
}: {
  planName: string;
  formattedPrice: string;
}) {
  return (
    <div
      className="siriso-pm-locked-banner"
      data-testid="siriso-workspace-locked-banner"
    >
      <div className="siriso-pm-locked-banner-icon">
        <Icon name="lock" size="1.05rem" />
      </div>
      <div className="siriso-pm-locked-banner-text">
        <h4 className="siriso-pm-locked-banner-title">
          Akses Workspace Terkunci — {planName} Diperlukan
        </h4>
        <p className="siriso-pm-locked-banner-desc">
          Workspace dan seluruh fiturnya terbuka dengan{" "}
          <strong>{planName} aktif</strong> ({formattedPrice}). Selesaikan
          pembayaran QRIS di bawah ini untuk membuka akses seketika.
        </p>
      </div>
    </div>
  );
}

export function SirisoProModal() {
  const {
    isPro,
    isLoggedIn,
    isAdFree,
    canUseWorkspace,
    role,
    proState,
    pricing,
    activeQrisOrder,
    isProModalOpen,
    pendingWorkspaceEntry,
    closeProModal,
    enterWorkspace,
    loginAccount,
    registerAccount,
    createQrisPayment,
    confirmQrisPayment,
    checkQrisPaymentStatus,
    logoutAccount,
    activateLicense,
    refreshStatus,
    isChecking,
  } = useSirisoPro();

  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [payerNote, setPayerNote] = useState("");
  const [copiedNominal, setCopiedNominal] = useState(false);
  const [showOfflineCodeBox, setShowOfflineCodeBox] = useState(false);
  const [offlineCode, setOfflineCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  /** A Pro customer chose to extend their plan before it runs out. */
  const [showRenew, setShowRenew] = useState(false);
  useEffect(() => {
    if (!isProModalOpen) setShowRenew(false);
  }, [isProModalOpen]);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  // Poll only while a bill is open and unpaid; stop once it is settled or cancelled.
  const pollOrderId =
    activeQrisOrder &&
    (activeQrisOrder.status === "pending" ||
      activeQrisOrder.status === "waiting_verification")
      ? activeQrisOrder.orderId
      : null;
  useEffect(() => {
    if (
      !isProModalOpen ||
      !isLoggedIn ||
      (isAdFree && !showRenew) ||
      !pollOrderId
    )
      return;
    const timer = window.setInterval(() => {
      void checkQrisPaymentStatus(pollOrderId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [
    isProModalOpen,
    isLoggedIn,
    isAdFree,
    showRenew,
    pollOrderId,
    checkQrisPaymentStatus,
  ]);

  useEffect(() => {
    if (!isProModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeProModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isProModalOpen, closeProModal]);

  if (!isProModalOpen) {
    return null;
  }

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (authTab === "login") {
      if (!email.trim() || !password) {
        setFeedback({
          type: "error",
          message: "Masukkan alamat email dan kata sandi akun Anda.",
        });
        return;
      }
      const res = await loginAccount(email, password);
      setFeedback({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      if (res.success) {
        setPassword("");
      }
      return;
    }

    if (!name.trim() || !email.trim() || password.length < 6) {
      setFeedback({
        type: "error",
        message:
          "Lengkapi nama, email aktif, dan kata sandi minimal 6 karakter.",
      });
      return;
    }
    const res = await registerAccount(name, email, password);
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
    if (res.success) {
      setPassword("");
    }
  };

  const handleOpenQrisGateway = async (forceNew = false) => {
    setFeedback(null);
    const res = await createQrisPayment(forceNew);
    if (!res.success) {
      setFeedback({
        type: "error",
        message: res.message,
      });
    }
  };

  const handleConfirmQris = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeQrisOrder) return;
    setFeedback(null);
    const res = await confirmQrisPayment(activeQrisOrder.orderId, payerNote);
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
  };

  const handleCopyQrisNominal = () => {
    if (!activeQrisOrder) return;
    void navigator.clipboard.writeText(String(activeQrisOrder.totalAmount));
    setCopiedNominal(true);
    setTimeout(() => setCopiedNominal(false), 2000);
  };

  const handleRefreshAccount = async () => {
    setFeedback(null);
    await refreshStatus();
    if (activeQrisOrder) {
      await checkQrisPaymentStatus(activeQrisOrder.orderId);
    }
    setFeedback({
      type: "success",
      message: "Status akun & pembayaran QRIS berhasil diperbarui.",
    });
  };

  const handleLogout = () => {
    setFeedback(null);
    setAuthTab("login");
    setPassword("");
    logoutAccount();
  };

  const handleOfflineActivate = async (e: FormEvent) => {
    e.preventDefault();
    const clean = offlineCode.trim();
    if (!clean) {
      setFeedback({
        type: "error",
        message: "Masukkan kode aktivasi offline aplikasi Desktop.",
      });
      return;
    }
    setFeedback(null);
    const res = await activateLicense(clean);
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
    if (res.success) {
      setOfflineCode("");
    }
  };

  const desktopCode = proState.desktopActivationCode || proState.licenseKey;
  const downloadUrl = getSirisoDesktopDownloadUrl(desktopCode);
  const privileged = role === "staff" || role === "admin";

  const handleCopyDesktopCode = () => {
    if (!desktopCode) return;
    void navigator.clipboard.writeText(desktopCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  /* The QRIS checkout, shared by first-time upgrades and Pro renewals. */
  const paymentSection = (
    <>
      {!activeQrisOrder || activeQrisOrder.status === "expired" ? (
        <div className="siriso-pm-panel siriso-pm-panel--highlight">
          <p className="siriso-pm-panel-title">
            <Icon name="star" size="1rem" />
            <span>Aktifkan Paket Pro via Payment Gateway QRIS</span>
          </p>
          <p className="siriso-pm-panel-desc">
            Bayar instan menggunakan <strong>QRIS Resmi</strong> (BCA Mobile,
            Livin&apos; Mandiri, BRImo, BNI, GoPay, DANA, OVO, ShopeePay).
            Begitu pembayaran terverifikasi, akun{" "}
            <strong>{proState.customerEmail}</strong> otomatis bebas iklan di
            web dan membuka unduhan + kode offline aplikasi Desktop.
          </p>
          <button
            type="button"
            className="siriso-pm-btn siriso-pm-btn-primary"
            onClick={() => void handleOpenQrisGateway(false)}
            disabled={isChecking}
            data-testid="siriso-open-qris-btn"
          >
            <Icon name="badge-check" size="1.05rem" />
            <span>
              {isChecking
                ? "Membuat Tagihan QRIS..."
                : "Bayar & Aktifkan Paket Pro via QRIS"}
            </span>
          </button>
        </div>
      ) : (
        <div
          className="siriso-pm-qris-card"
          data-testid="siriso-qris-gateway-card"
        >
          <div className="siriso-pm-qris-head">
            <span className="siriso-pm-qris-badge">
              <Icon name="sparkles" size="0.8rem" />
              <span>QRIS PAYMENT GATEWAY</span>
            </span>
            <span
              className="siriso-pm-qris-order-id"
              data-testid="siriso-qris-order-id"
            >
              {activeQrisOrder.orderId}
            </span>
          </div>

          <div className="siriso-pm-qris-body">
            <div className="siriso-pm-qris-frame">
              <span className="siriso-pm-qris-merchant">
                {activeQrisOrder.merchantName}
              </span>
              <span className="siriso-pm-qris-nmid">
                NMID: {activeQrisOrder.nmid}
              </span>
              {activeQrisOrder.qrisImageUrl ? (
                <img
                  src={activeQrisOrder.qrisImageUrl}
                  alt={`QRIS ${activeQrisOrder.merchantName}`}
                  className="siriso-pm-qris-img"
                  data-testid="siriso-qris-custom-img"
                />
              ) : (
                <div data-testid="siriso-qris-canvas-wrap">
                  <QRCodeCanvas
                    value={activeQrisOrder.qrisPayload}
                    size={160}
                    level="M"
                    includeMargin
                  />
                </div>
              )}
              <span className="siriso-pm-qris-nmid">SATU QRIS UNTUK SEMUA</span>
            </div>

            <div className="siriso-pm-qris-details">
              <div>
                <span className="siriso-pm-label">
                  Total Bayar (Sesuai Kode Unik)
                </span>
                <div className="siriso-pm-qris-amount-box">
                  <span
                    className="siriso-pm-qris-amount-value"
                    data-testid="siriso-qris-amount"
                  >
                    {activeQrisOrder.formattedTotal}
                  </span>
                  <button
                    type="button"
                    className="siriso-pm-btn-copy"
                    onClick={handleCopyQrisNominal}
                    title="Salin nominal unik"
                    data-testid="siriso-qris-copy-btn"
                  >
                    <Icon name="copy" size="0.85rem" />
                    <span>{copiedNominal ? "Tersalin!" : "Salin"}</span>
                  </button>
                </div>
              </div>

              <p className="siriso-pm-qris-note">
                Scan QRIS di samping menggunakan{" "}
                <strong>
                  {activeQrisOrder.supportedApps ||
                    "BCA, Mandiri, BRI, GoPay, DANA, OVO, ShopeePay"}
                </strong>{" "}
                dengan nominal tepat{" "}
                <strong>{activeQrisOrder.formattedTotal}</strong>.
              </p>

              {activeQrisOrder.status === "waiting_verification" ? (
                <div
                  className="siriso-pm-alert siriso-pm-alert--info"
                  style={{ marginBottom: 0 }}
                  data-testid="siriso-qris-waiting-badge"
                >
                  <Icon name="refresh-cw" size="0.95rem" />
                  <span>
                    <strong>Menunggu Verifikasi Mutasi QRIS</strong> —
                    Pembayaran Anda sedang dicek otomatis. Status Pro akan aktif
                    otomatis begitu mutasi masuk.
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={handleConfirmQris}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <input
                    type="text"
                    className="siriso-pm-input"
                    placeholder="Nama Pengirim / Bank / E-Wallet (mis. BCA - Budi)"
                    value={payerNote}
                    onChange={(e) => setPayerNote(e.currentTarget.value)}
                    disabled={isChecking}
                    data-testid="siriso-qris-payer-note"
                  />
                  <button
                    type="submit"
                    className="siriso-pm-btn siriso-pm-btn-primary"
                    disabled={isChecking}
                    data-testid="siriso-confirm-qris-btn"
                  >
                    <Icon name="badge-check" size="1rem" />
                    <span>
                      {isChecking
                        ? "Memverifikasi..."
                        : "Saya Sudah Membayar via QRIS"}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className="siriso-pm-backdrop"
      onClick={closeProModal}
      data-testid="siriso-pro-modal"
    >
      <div
        className="siriso-pm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="siriso-pm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="siriso-pm-close"
          onClick={closeProModal}
          aria-label="Tutup dialog"
          data-testid="siriso-pro-modal-close"
        >
          <Icon name="x" size="1.05rem" />
        </button>

        <div className="siriso-pm-grid">
          <aside className="siriso-pm-aside">
            <div>
              <div className="siriso-pm-eyebrow">
                <span className="siriso-pm-eyebrow-dot" />
                <span>SIRISO LAB // PAKET PRO</span>
              </div>

              <h2 id="siriso-pm-dialog-title" className="siriso-pm-title">
                Siriso PDF {pricing.name}
              </h2>
              <p className="siriso-pm-subtitle">{pricing.description}</p>

              <div className="siriso-pm-price-box">
                <span className="siriso-pm-price-label">
                  {pricing.promoLabel || "Langganan"}
                </span>
                <span className="siriso-pm-price-value">
                  {pricing.compareAtPrice > pricing.price && (
                    <s className="siriso-pm-price-compare">
                      {pricing.formattedCompareAt}
                    </s>
                  )}
                  {pricing.formattedPrice}
                </span>
              </div>

              <div className="siriso-pm-perks">
                {pricing.features.map((feature, idx) => (
                  <div className="siriso-pm-perk" key={feature}>
                    <div className="siriso-pm-perk-icon">
                      <Icon
                        name={
                          (
                            [
                              "badge-check",
                              "download",
                              "sparkles",
                              "log-in",
                            ] as const
                          )[idx % 4]
                        }
                        size="1.05rem"
                      />
                    </div>
                    <div>
                      <h3 className="siriso-pm-perk-title">{feature}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="siriso-pm-aside-foot">
              Satu akun Siriso PDF berlaku untuk akses Workspace Web bebas iklan
              sekaligus lisensi offline aplikasi Desktop Windows Anda.
            </div>
          </aside>

          <div className="siriso-pm-main">
            <div>
              {pendingWorkspaceEntry && !isLoggedIn && (
                <div
                  className="siriso-pm-alert siriso-pm-alert--info"
                  data-testid="siriso-workspace-auth-required"
                >
                  <Icon name="lock" size="1.05rem" />
                  <span>
                    <strong>Akses Workspace Memerlukan Akun</strong> — Silakan
                    masuk atau daftar akun Siriso terlebih dahulu untuk membuka
                    Workspace PDF.
                  </span>
                </div>
              )}

              {feedback && (
                <div
                  className={`siriso-pm-alert ${
                    feedback.type === "success"
                      ? "siriso-pm-alert--success"
                      : "siriso-pm-alert--error"
                  }`}
                >
                  <Icon
                    name={
                      feedback.type === "success"
                        ? "badge-check"
                        : "circle-alert"
                    }
                    size="1.05rem"
                  />
                  <span>{feedback.message}</span>
                </div>
              )}

              {!isLoggedIn ? (
                <>
                  <div
                    className="siriso-pm-tabs"
                    role="tablist"
                    aria-label="Autentikasi Akun Siriso PDF"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authTab === "login"}
                      className={`siriso-pm-tab ${
                        authTab === "login" ? "siriso-pm-tab--active" : ""
                      }`}
                      onClick={() => {
                        setAuthTab("login");
                        setFeedback(null);
                      }}
                      data-testid="siriso-tab-login"
                    >
                      Masuk Akun
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authTab === "register"}
                      className={`siriso-pm-tab ${
                        authTab === "register" ? "siriso-pm-tab--active" : ""
                      }`}
                      onClick={() => {
                        setAuthTab("register");
                        setFeedback(null);
                      }}
                      data-testid="siriso-tab-register"
                    >
                      Daftar Akun Baru
                    </button>
                  </div>

                  <h3 className="siriso-pm-heading">
                    {authTab === "login"
                      ? "Masuk ke Akun Siriso PDF"
                      : "Buat Akun Pelanggan Siriso PDF"}
                  </h3>
                  <p className="siriso-pm-subheading">
                    {authTab === "login"
                      ? "Masuk menggunakan email terdaftar untuk menikmati akses Paket Pro bebas iklan atau mengunduh aplikasi Desktop."
                      : "Daftarkan email Anda agar akses Paket Pro dapat langsung diaktifkan pada akun Anda."}
                  </p>

                  <form className="siriso-pm-form" onSubmit={handleAuthSubmit}>
                    {authTab === "register" && (
                      <div className="siriso-pm-field">
                        <label
                          className="siriso-pm-label"
                          htmlFor="siriso-pm-name"
                        >
                          Nama Lengkap
                        </label>
                        <input
                          id="siriso-pm-name"
                          type="text"
                          className="siriso-pm-input"
                          placeholder="Masukkan nama lengkap Anda"
                          value={name}
                          onChange={(e) => setName(e.currentTarget.value)}
                          disabled={isChecking}
                          data-testid="siriso-input-name"
                        />
                      </div>
                    )}

                    <div className="siriso-pm-field">
                      <label
                        className="siriso-pm-label"
                        htmlFor="siriso-pm-email"
                      >
                        Alamat Email
                      </label>
                      <input
                        id="siriso-pm-email"
                        type="email"
                        className="siriso-pm-input"
                        placeholder="nama@perusahaan.com"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        disabled={isChecking}
                        data-testid="siriso-input-email"
                      />
                    </div>

                    <div className="siriso-pm-field">
                      <label
                        className="siriso-pm-label"
                        htmlFor="siriso-pm-password"
                      >
                        Kata Sandi
                      </label>
                      <input
                        id="siriso-pm-password"
                        type="password"
                        className="siriso-pm-input"
                        placeholder={
                          authTab === "login"
                            ? "Masukkan kata sandi"
                            : "Minimal 6 karakter"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        disabled={isChecking}
                        data-testid="siriso-input-password"
                      />
                    </div>

                    <button
                      type="submit"
                      className="siriso-pm-btn siriso-pm-btn-primary"
                      disabled={isChecking}
                      data-testid="siriso-auth-submit"
                    >
                      <Icon name="log-in" size="1.05rem" />
                      <span>
                        {isChecking
                          ? "Memproses..."
                          : authTab === "login"
                            ? "Masuk ke Akun Siriso"
                            : "Daftar & Masuk Sekarang"}
                      </span>
                    </button>
                  </form>
                </>
              ) : isAdFree ? (
                <div className="siriso-pm-form">
                  <AccountCard
                    pro
                    name={proState.customerName}
                    email={proState.customerEmail}
                    nameFallback="Pelanggan Siriso Pro"
                    emailFallback="Akses Pro Terverifikasi"
                    badge={
                      <span
                        className="siriso-pm-status-badge siriso-pm-status-badge--pro"
                        data-testid="siriso-account-status"
                      >
                        <Icon name="badge-check" size="0.85rem" />
                        <span>
                          {isPro
                            ? `${pricing.name} Aktif`
                            : `Akses Penuh · ${ROLE_LABEL[role] ?? "Tim"}`}
                        </span>
                      </span>
                    }
                  />

                  <div className="siriso-pm-panel">
                    <p className="siriso-pm-panel-title">
                      <Icon name="sparkles" size="1rem" />
                      <span>Akses Web Bebas Iklan Aktif</span>
                    </p>
                    <AdFreeAccessNote
                      isPro={isPro}
                      planName={pricing.name}
                      roleLabel={ROLE_LABEL[role]}
                      expiresAt={proState.expiresAt}
                    />
                  </div>

                  <div className="siriso-pm-panel siriso-pm-panel--highlight">
                    <p className="siriso-pm-panel-title">
                      <Icon name="download" size="1rem" />
                      <span>
                        Aplikasi Siriso PDF Desktop (Windows x64) & Kode Offline
                      </span>
                    </p>
                    <p className="siriso-pm-panel-desc">
                      Unduh paket aplikasi Desktop untuk Windows. Gunakan{" "}
                      <strong>Kode Aktivasi Offline</strong> di bawah ini saat
                      membuka aplikasi Desktop agar dapat berjalan tanpa koneksi
                      internet:
                    </p>

                    {desktopCode && (
                      <DesktopCodeBox
                        code={desktopCode}
                        copied={copiedCode}
                        onCopy={handleCopyDesktopCode}
                      />
                    )}

                    <button
                      type="button"
                      className="siriso-pm-btn siriso-pm-btn-primary"
                      onClick={() => window.open(downloadUrl, "_blank")}
                      data-testid="siriso-download-desktop-btn"
                    >
                      <Icon name="download" size="1.05rem" />
                      <span>Unduh Siriso PDF Desktop (Windows x64)</span>
                    </button>
                  </div>

                  {isPro &&
                    !privileged &&
                    (showRenew ? (
                      paymentSection
                    ) : (
                      <button
                        type="button"
                        className="siriso-pm-btn siriso-pm-btn-secondary"
                        onClick={() => {
                          setShowRenew(true);
                          void handleOpenQrisGateway(false);
                        }}
                        disabled={isChecking}
                        data-testid="siriso-renew-btn"
                      >
                        <Icon name="refresh-cw" size="0.9rem" />
                        <span>
                          Perpanjang {pricing.planDays} hari —{" "}
                          {pricing.formattedPrice}
                        </span>
                      </button>
                    ))}

                  <AdFreeAccountActions
                    isChecking={isChecking}
                    onEnterWorkspace={() => enterWorkspace()}
                    onRefresh={handleRefreshAccount}
                    onLogout={handleLogout}
                  />
                </div>
              ) : (
                <div className="siriso-pm-form">
                  <AccountCard
                    name={proState.customerName}
                    email={proState.customerEmail}
                    nameFallback="Pengguna Siriso PDF"
                    badge={
                      <span
                        className={`siriso-pm-status-badge ${
                          proState.proStatus === "pending"
                            ? "siriso-pm-status-badge--pending"
                            : "siriso-pm-status-badge--free"
                        }`}
                      >
                        <span>
                          {proState.proStatus === "pending"
                            ? "Menunggu Konfirmasi"
                            : "Belum Aktif (Perlu Bayar)"}
                        </span>
                      </span>
                    }
                  />

                  {canUseWorkspace ? (
                    <div className="siriso-pm-panel">
                      <p className="siriso-pm-panel-title">
                        <Icon name="layout-grid" size="1rem" />
                        <span>Workspace terbuka untuk akun gratis</span>
                      </p>
                      <p className="siriso-pm-panel-desc">
                        Anda bisa langsung memakai Workspace PDF dengan iklan.
                        Upgrade ke <strong>{pricing.name}</strong> untuk bebas
                        iklan dan membuka aplikasi Desktop Windows.
                      </p>
                      <button
                        type="button"
                        className="siriso-pm-btn siriso-pm-btn-secondary siriso-pm-btn-sm"
                        onClick={() => enterWorkspace()}
                        data-testid="siriso-modal-enter-workspace-btn"
                      >
                        <Icon name="layout-grid" size="0.9rem" />
                        <span>Buka Workspace PDF</span>
                      </button>
                    </div>
                  ) : (
                    <WorkspaceLockedBanner
                      planName={pricing.name}
                      formattedPrice={pricing.formattedPrice}
                    />
                  )}

                  {paymentSection}

                  <div className="siriso-pm-actions-row">
                    <button
                      type="button"
                      className="siriso-pm-btn siriso-pm-btn-secondary"
                      onClick={handleRefreshAccount}
                      disabled={isChecking}
                      data-testid="siriso-refresh-status-btn"
                    >
                      <Icon name="refresh-cw" size="0.9rem" />
                      <span>
                        {isChecking
                          ? "Memeriksa Status..."
                          : "Cek Status Pembayaran"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="siriso-pm-btn siriso-pm-btn-secondary"
                      onClick={handleLogout}
                      data-testid="siriso-logout-btn"
                    >
                      <Icon name="log-out" size="0.9rem" />
                      <span>Keluar Akun</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!isAdFree && (
              <div className="siriso-pm-offline-toggle">
                <button
                  type="button"
                  className="siriso-pm-offline-link"
                  onClick={() => setShowOfflineCodeBox((prev) => !prev)}
                  data-testid="siriso-offline-code-toggle"
                >
                  <Icon name="key" size="0.88rem" />
                  <span>
                    {showOfflineCodeBox
                      ? "Sembunyikan input Kode Aktivasi Offline Desktop"
                      : "Menggunakan Aplikasi Desktop Offline? Masukkan Kode Aktivasi Desktop"}
                  </span>
                </button>

                {showOfflineCodeBox && (
                  <form
                    onSubmit={handleOfflineActivate}
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      className="siriso-pm-input"
                      placeholder="Kode Offline Desktop (mis. SRP-DESK-XXXX-XXXX)"
                      value={offlineCode}
                      onChange={(e) =>
                        setOfflineCode(e.currentTarget.value.toUpperCase())
                      }
                      disabled={isChecking}
                      data-testid="siriso-offline-code-input"
                    />
                    <button
                      type="submit"
                      className="siriso-pm-btn siriso-pm-btn-secondary siriso-pm-btn-sm"
                      disabled={isChecking || !offlineCode.trim()}
                      style={{ flexShrink: 0, padding: "0.68rem 0.95rem" }}
                    >
                      Aktifkan Offline
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
