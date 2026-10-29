import sirisoMarkUrl from "@editor/assets/brand/modern-logo/SirisoLogo.png";
import "@editor/components/shared/BrandMark.css";

interface BrandMarkProps {
  /** Height of the mark (CSS length). */
  height?: string;
  className?: string;
}

/** The Siriso mark, shared by navigation and app-switch controls. */
export function BrandMark({ height = "1.6rem", className }: BrandMarkProps) {
  return (
    <img
      src={sirisoMarkUrl}
      alt="Siriso PDF"
      style={{ height }}
      className={["sui-brandmark", className].filter(Boolean).join(" ")}
    />
  );
}
