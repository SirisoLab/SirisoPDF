import { useState } from "react";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { SirisoAdSlot } from "@editor/components/shared/siriso/SirisoAdSlot";
import { isOfficialGoogleAdSlot } from "@editor/services/sirisoProService";

export function SirisoStickyAdBar() {
  const { isAdFree, adsConfig, openProModal } = useSirisoPro();
  const [dismissed, setDismissed] = useState(false);

  const slot = adsConfig.bottomSticky;
  if (
    isAdFree ||
    !adsConfig.enabled ||
    !isOfficialGoogleAdSlot(slot) ||
    dismissed
  ) {
    return null;
  }
  const badgeLabel = slot?.badge || adsConfig.badgeText || "GOOGLE ADSENSE";

  return (
    <aside
      className="siriso-sticky-ad-bar"
      aria-label="Iklan Komersial & Promosi"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        background: "rgba(15, 17, 23, 0.98)",
        backdropFilter: "blur(14px)",
        borderTop: "1px solid rgba(245, 159, 0, 0.35)",
        boxShadow: "0 -6px 24px rgba(0, 0, 0, 0.45)",
      }}
    >
      {/* Top micro bar: Iklan badge + Hilangkan Iklan (Pro) + Close button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 16px",
          background: "rgba(22, 25, 34, 0.98)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "3px",
              background: "rgba(245, 159, 0, 0.15)",
              color: "#fcc419",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
            }}
          >
            {badgeLabel}
          </span>
          <span
            style={{
              color: "#868e96",
              fontSize: "0.72rem",
            }}
          >
            Iklan Komersial
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={openProModal}
            style={{
              background: "linear-gradient(135deg, #e67700 0%, #d9480f 100%)",
              border: "none",
              color: "#ffffff",
              fontSize: "0.74rem",
              fontWeight: 600,
              padding: "2px 10px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <Icon name="sparkles" size="0.85rem" />
            <span>
              Hilangkan Iklan (Paket Pro - {adsConfig.priceFormatted})
            </span>
          </button>

          <button
            type="button"
            aria-label="Tutup iklan sementara"
            onClick={() => setDismissed(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "#868e96",
              cursor: "pointer",
              padding: "3px",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
            title="Tutup iklan untuk sesi ini"
          >
            <Icon name="x" size="1rem" />
          </button>
        </div>
      </div>

      {/* Main Ad Slot Display Area */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "6px 12px 8px",
          minHeight: "50px",
          maxHeight: "96px",
          width: "100%",
        }}
      >
        <SirisoAdSlot slot={slot} maxHeight={90} />
      </div>
    </aside>
  );
}
