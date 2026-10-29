import { useEffect, useRef } from "react";
import {
  isOfficialGoogleAdSlot,
  SirisoAdSlotConfig,
} from "@editor/services/sirisoProService";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface SirisoAdSlotProps {
  slot?: SirisoAdSlotConfig;
  className?: string;
  maxHeight?: number;
}

export function SirisoAdSlot({
  slot,
  className,
  maxHeight = 90,
}: SirisoAdSlotProps) {
  const adsenseRef = useRef<HTMLModElement | null>(null);
  const isOfficialAdSense = isOfficialGoogleAdSlot(slot);

  useEffect(() => {
    if (isOfficialAdSense && slot?.adsenseClient && slot?.adsenseSlot) {
      try {
        if (typeof window !== "undefined") {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
        }
      } catch {
        // ignore adsbygoogle duplicate push errors
      }
    }
  }, [isOfficialAdSense, slot?.adsenseClient, slot?.adsenseSlot]);

  if (!isOfficialAdSense || !slot) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        width: "100%",
        maxHeight: `${maxHeight}px`,
      }}
    >
      <ins
        ref={adsenseRef}
        className="adsbygoogle"
        style={{
          display: "inline-block",
          width: "728px",
          height: `${maxHeight}px`,
          maxWidth: "100%",
        }}
        data-ad-client={slot.adsenseClient}
        data-ad-slot={slot.adsenseSlot}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
