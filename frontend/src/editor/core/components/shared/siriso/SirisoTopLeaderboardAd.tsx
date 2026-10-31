import { useState } from "react";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { SirisoAdSlot } from "@editor/components/shared/siriso/SirisoAdSlot";
import { isOfficialGoogleAdSlot } from "@editor/services/sirisoProService";

export function SirisoTopLeaderboardAd() {
  const { isAdFree, adsConfig, openProModal } = useSirisoPro();
  const [dismissed, setDismissed] = useState(false);

  const slot = adsConfig.topLeaderboard;
  if (
    isAdFree ||
    !adsConfig.enabled ||
    !isOfficialGoogleAdSlot(slot) ||
    dismissed
  ) {
    return null;
  }

  return (
    <aside
      className="siriso-top-leaderboard-ad"
      aria-label="Iklan Banner Leaderboard"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px 10px",
        background: "var(--c-surface-1, #1a1b23)",
        borderBottom: "1px solid var(--c-border-subtle, rgba(255,255,255,0.08))",
        width: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "728px",
          width: "100%",
          marginBottom: "4px",
          fontSize: "0.72rem",
          color: "var(--c-text-subtle, #868e96)",
        }}
      >
        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontWeight: 600,
          }}
        >
          {slot.badge || "IKLAN / SPONSORED"}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={openProModal}
            style={{
              background: "none",
              border: "none",
              color: "var(--c-accent, #f59f00)",
              cursor: "pointer",
              fontSize: "0.72rem",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Hilangkan Iklan (Paket Pro)
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Tutup iklan leaderboard"
            style={{
              background: "none",
              border: "none",
              color: "#868e96",
              cursor: "pointer",
              padding: "2px",
              display: "inline-flex",
            }}
          >
            <Icon name="x" size="0.9rem" />
          </button>
        </div>
      </div>

      <SirisoAdSlot slot={slot} maxHeight={90} />
    </aside>
  );
}
