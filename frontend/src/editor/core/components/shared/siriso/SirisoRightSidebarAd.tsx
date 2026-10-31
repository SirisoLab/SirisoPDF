import { useState } from "react";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { SirisoAdSlot } from "@editor/components/shared/siriso/SirisoAdSlot";
import { isOfficialGoogleAdSlot } from "@editor/services/sirisoProService";

export function SirisoRightSidebarAd() {
  const { isAdFree, adsConfig, openProModal } = useSirisoPro();
  const [dismissed, setDismissed] = useState(false);

  const slot = adsConfig.rightSidebar;
  if (
    isAdFree ||
    !adsConfig.enabled ||
    !isOfficialGoogleAdSlot(slot) ||
    dismissed
  ) {
    return null;
  }

  return (
    <>
      <style>{`
        @media (max-width: 1300px) {
          .siriso-right-sidebar-ad {
            display: none !important;
          }
        }
      `}</style>
      <aside
        className="siriso-right-sidebar-ad"
        aria-label="Iklan Display Sidebar Kanan"
        style={{
          position: "fixed",
          right: "16px",
          top: "70px",
          width: "300px",
          zIndex: 900,
          display: "flex",
          flexDirection: "column",
          background: "rgba(18, 20, 26, 0.96)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
      >
      {/* Header with ADVERTISEMENT badge & Close button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 8px",
          background: "rgba(28, 31, 40, 0.98)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: "0.68rem",
          color: "#94a3b8",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            letterSpacing: "0.6px",
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
              color: "#f59f00",
              cursor: "pointer",
              fontSize: "0.68rem",
              textDecoration: "underline",
              padding: 0,
            }}
            title="Hilangkan iklan dengan Paket Pro"
          >
            Bebas Iklan
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Tutup iklan"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "2px",
              display: "inline-flex",
            }}
            title="Tutup banner iklan"
          >
            <Icon name="x" size="0.9rem" />
          </button>
        </div>
      </div>

      {/* Ad content: 300x600 or 300x250 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "6px",
          maxHeight: "600px",
          overflow: "hidden",
        }}
      >
        <SirisoAdSlot slot={slot} maxHeight={600} />
      </div>
    </aside>
  </>
  );
}
