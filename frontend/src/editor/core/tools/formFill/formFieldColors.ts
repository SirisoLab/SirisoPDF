/**
 * Form overlay palette, deliberately not per-type: slate = existing, Siriso orange = selected/new, red =
 * delete. Field type is conveyed by the side-panel icon, not by a fill colour on the page.
 */
export const FORM_COLORS = {
  /** Selected / active / newly-drawn fields. */
  accent: "var(--c-accent-on-light)",
  accentFillSoft: "color-mix(in srgb, var(--c-accent-on-light) 6%, transparent)",
  accentFill: "color-mix(in srgb, var(--c-accent-on-light) 10%, transparent)",

  /** Existing (unselected) fields - quiet slate so the page stays readable. */
  neutralBorder: "rgba(71, 85, 105, 0.55)",
  neutralFill: "rgba(71, 85, 105, 0.05)",
  neutralChip: "#475569",

  /** Fields marked for deletion. */
  danger: "#dc2626",
  dangerFill: "rgba(220, 38, 38, 0.08)",

  /** Alignment guides (thin lines, shown only while dragging). */
  guide: "var(--c-accent-on-light)",
} as const;
