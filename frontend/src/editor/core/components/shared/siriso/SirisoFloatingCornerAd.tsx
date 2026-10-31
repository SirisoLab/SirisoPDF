import { useState } from "react";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { SirisoAdSlot } from "@editor/components/shared/siriso/SirisoAdSlot";
import { isOfficialGoogleAdSlot } from "@editor/services/sirisoProService";

export function SirisoFloatingCornerAd() {
  const { isAdFree, adsConfig, openProModal } = useSirisoPro();
  const [dismissed, setDismissed] = useState(false);

  const slot = adsConfig.floatingCorner;
  if (
    isAdFree ||
    !adsConfig.enabled ||
    !isOfficialGoogleAdSlot(slot) ||
    dismissed
  ) {
    return null;
  }
  const bottomOffset = isOfficialGoogleAdSlot(adsConfig.bottomSticky)
    ? "128px"
    : "16px";

  return (
    <aside
      className="siriso-floating-corner-ad"
      aria-label="Iklan Mengambang Pojok"
      style={{
        position: "fixed",
        right: "16px",
        bottom: bottomOffset,
        width: "300px",
        zIndex: 950,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        borderRadius: "8px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
        border: "1px solid rgba(0, 0, 0, 0.12)",
        overflow: "hidden",
        animation: "sirisoFadeIn 0.3s ease",
      }}
    >
      {/* Top Header bar with Close button and ADVERTISEMENT */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "3px 8px",
          background: "#f1f5f9",
          borderBottom: "1px solid #e2e8f0",
          fontSize: "0.68rem",
          color: "#64748b",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          {slot.badge || "ADVERTISEMENT"}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={openProModal}
            style={{
              background: "none",
              border: "none",
              color: "#e67700",
              cursor: "pointer",
              fontSize: "0.68rem",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Bebas Iklan
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Tutup iklan"
            style={{
              background: "#94a3b8",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              padding: "2px",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
            }}
            title="Tutup iklan"
          >
            <Icon name="x" size="0.75rem" />
          </button>
        </div>
      </div>

      {/* Ad slot body (150px height) */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "4px",
          maxHeight: "160px",
          overflow: "hidden",
        }}
      >
        <SirisoAdSlot slot={slot} maxHeight={150} />
      </div>
    </aside>
  );
}
