import {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import type { SirisoRole } from "@editor/services/sirisoProService";
import "@editor/components/shared/siriso/SirisoAccountMenu.css";

const ROLE_LABEL: Record<SirisoRole, string> = {
  user: "Pelanggan",
  staff: "Tim Siriso",
  admin: "Admin",
};

export function getAccountInitials(name?: string, email?: string): string {
  const src = (name || email || "S").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export interface SirisoAccountMenuProps {
  /** "rail": avatar in the workspace rail; "landing": pill in the landing header. */
  variant: "rail" | "landing";
  /** Opens the app's own preferences page (rail only). */
  onOpenSettings?: () => void;
  /** Draws the avatar as current while the settings page is open. */
  settingsActive?: boolean;
}

/**
 * The single place a signed-in Siriso account is shown and signed out: name, plan, role and the
 * actions that belong to the account. Rendered in a portal so the rail's overflow never clips it.
 */
export function SirisoAccountMenu({
  variant,
  onOpenSettings,
  settingsActive = false,
}: SirisoAccountMenuProps) {
  const {
    isLoggedIn,
    isPro,
    role,
    isAdmin,
    canUseWorkspace,
    proState,
    openProModal,
    openLandingPage,
    enterWorkspace,
    logoutAccount,
  } = useSirisoPro();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setStyle(
      variant === "rail"
        ? {
            left: r.right + 10,
            bottom: Math.max(8, window.innerHeight - r.bottom),
          }
        : {
            top: r.bottom + 8,
            right: Math.max(8, window.innerWidth - r.right),
          },
    );
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    panelRef.current
      ?.querySelector<HTMLButtonElement>("[role=menuitem]")
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  // Signed out: the same spot offers sign-in instead of an empty menu.
  if (!isLoggedIn) {
    return variant === "rail" ? (
      <button
        type="button"
        className="siriso-acct-avatar is-guest"
        onClick={openProModal}
        title="Masuk ke akun Siriso"
        aria-label="Masuk ke akun Siriso"
        data-testid="siriso-account-button"
      >
        <Icon name="log-in" size="1rem" />
      </button>
    ) : null;
  }

  const privileged = role === "staff" || role === "admin";
  const name = proState.customerName || proState.customerEmail || "Akun Siriso";
  const initials = getAccountInitials(
    proState.customerName,
    proState.customerEmail,
  );
  const expiry = proState.expiresAt
    ? new Date(proState.expiresAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const status = isPro
    ? { text: expiry ? `Pro aktif s/d ${expiry}` : "Pro aktif", tone: "ok" }
    : privileged
      ? { text: "Akses penuh", tone: "ok" }
      : proState.proStatus === "pending"
        ? { text: "Menunggu aktivasi Pro", tone: "warn" }
        : proState.proStatus === "expired"
          ? { text: "Paket Pro berakhir", tone: "warn" }
          : { text: "Akun gratis", tone: "muted" };

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const signOut = run(() => {
    logoutAccount();
    navigate("/");
  });

  const trigger =
    variant === "rail" ? (
      <button
        ref={triggerRef}
        type="button"
        className={`siriso-acct-avatar${settingsActive ? " is-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Akun ${name}`}
        title={`${name} — Akun`}
        data-testid="siriso-account-button"
      >
        <span>{initials}</span>
        {(isPro || privileged) && <i className="siriso-acct-dot" />}
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        className="siriso-lp-btn siriso-lp-btn-outline-orange siriso-acct-pill"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="landing-account-button"
      >
        <span className="siriso-acct-mini">{initials}</span>
        <span className="siriso-acct-pill-name">{name}</span>
        <Icon name="chevron-down" size="0.9rem" />
      </button>
    );

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="Menu akun Siriso"
            className={`siriso-acct-panel siriso-acct-panel--${variant}`}
            style={style}
            data-testid="siriso-account-menu"
          >
            <div className="siriso-acct-head">
              <span className="siriso-acct-avatar-lg">{initials}</span>
              <div className="siriso-acct-id">
                <b>{name}</b>
                {proState.customerEmail && <span>{proState.customerEmail}</span>}
              </div>
            </div>
            <div className="siriso-acct-chips">
              {privileged && (
                <span className={`siriso-acct-chip is-role-${role}`}>
                  {ROLE_LABEL[role]}
                </span>
              )}
              <span className={`siriso-acct-chip is-${status.tone}`}>
                {status.text}
              </span>
            </div>
            <div className="siriso-acct-items">
              <button
                type="button"
                role="menuitem"
                onClick={run(openProModal)}
              >
                <Icon name="badge-check" size="1rem" />
                <span>Akun &amp; langganan</span>
              </button>
              {variant === "landing" && canUseWorkspace && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={run(() => enterWorkspace())}
                >
                  <Icon name="layout-grid" size="1rem" />
                  <span>Buka Workspace</span>
                </button>
              )}
              {variant === "rail" && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={run(() => {
                    openLandingPage();
                    navigate("/");
                  })}
                >
                  <Icon name="house" size="1rem" />
                  <span>Halaman utama Siriso PDF</span>
                </button>
              )}
              {onOpenSettings && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={run(onOpenSettings)}
                  data-testid="siriso-account-settings"
                >
                  <Icon name="settings" size="1rem" />
                  <span>{isAdmin ? "Pengaturan & sistem" : "Pengaturan"}</span>
                </button>
              )}
            </div>
            <div className="siriso-acct-sep" />
            <button
              type="button"
              role="menuitem"
              className="siriso-acct-logout"
              onClick={signOut}
              data-testid="siriso-account-logout"
            >
              <Icon name="log-out" size="1rem" />
              <span>Keluar</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
