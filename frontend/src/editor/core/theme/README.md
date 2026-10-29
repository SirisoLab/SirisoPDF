# Theme system (`core/theme/`)

Read this before touching colours or theming anywhere in the frontend.

## TL;DR rules

1. **Never write a raw colour** (`#hex`, `rgb()`, `hsl()`, or a named colour like `red`) in a component, inline style, or stylesheet. Use a token:
   - `var(--c-…)` — a **semantic** token (preferred: `--c-text`, `--c-surface`, `--c-primary`, …).
   - `var(--p-…)` — a **palette** primitive, only when no semantic token fits.
2. **The only file allowed to contain literal colours is `primitives.css`.** If you need a new hue, add it there first, then reference it.
3. Structural `black` / `white` / `transparent` (shadows, scrims, overlays) are allowed anywhere.
4. Colours must adapt to light/dark automatically. If you're reaching for a hardcoded colour "just for dark mode", you're doing it wrong — pick the right `--c-*` token.
5. `task frontend:lint:colors` enforces rules 1–3 **inside `core/theme/`** (see [Linter](#linter)).

## Files

| File | Role |
|---|---|
| `primitives.css` | **The palette.** 41 literal colours (`--p-*`) — one neutral ramp (`--p-gray-*` light, `--p-zinc-*` dark) + status hues (blue/green/amber/red). The ONLY place literals live. |
| `colors.css` | **Semantic tokens** (`--c-*`), mapped from primitives per theme. This is what you should reference. |
| `dimensions.css` | Non-colour tokens: spacing, radius, z-index, type, motion. |
| `index.css` | Barrel that `@import`s the above. Imported by `ThemeProvider` (and Storybook). |
| `mantineTheme.ts` | Mantine theme object wiring. |

The old `compat.css` legacy-alias layer has been removed — every component now references `--c-*` directly. Two **legacy** colour files still exist outside this folder and are being phased out — prefer `--c-*` over their tokens, and don't add to them:
`core/styles/theme.css` (editor `--bg-*`/`--text-*` vocab) and `core/tokens/tokens.css` (SUI `--color-*` vocab, gradients, code palette).

## Semantic tokens (`--c-*`)

Reference these, not primitives, wherever possible:

- **Surfaces (elevation):** `--c-bg` (canvas) < `--c-bg-raised` (sidebars/toolbars) < `--c-surface` (cards/modals) < `--c-surface-raised` < `--c-surface-sunken`; plus `--c-input-bg`, `--c-hover`, `--c-active`, `--c-overlay`.
- **Text:** `--c-text`, `--c-text-muted`, `--c-text-subtle`, `--c-text-on-primary` (foreground on a filled primary).
- **Borders:** `--c-border`, `--c-border-subtle`, `--c-border-strong`.
- **Accent:** `--c-primary`, `--c-primary-hover`, `--c-primary-subtle`, and `--c-accent-fg` (see below).
- **Status:** `--c-success`, `--c-danger`.

## Theme model

The mode is light, dark or system, stored in preferences.theme. ThemeProvider
resolves it and sets data-theme, data-mantine-color-scheme, data-app-theme="custom"
and data-accent="default" on the document root.

Siriso uses a fixed orange brand accent with neutral surfaces in both schemes.
The primitive ramp is --p-siriso-orange-*. Primary filled controls use the deeper
600 step with a white label; accent text uses 700 on light surfaces and 400 on
dark surfaces. The logo's bright orange is 500. Use --c-primary for controls,
--c-accent-text for foregrounds and --c-accent-on-light for editing guides drawn
over a white PDF page. The legacy SUI and Mantine primary ramps derive from the
same tokens. This does not recolour document content or selectable ink pigments.

## Linter

One file: `scripts/lint/theme-lint.mjs` (no baseline). Run via `task frontend:lint:colors` (part of `task frontend:lint`).

- **Default (blocking):** enforces "literals only in `primitives.css`; everything else in `core/theme/` references tokens; no duplicate primitives." Scope is deliberately just `core/theme/` — the layer this owns, which is clean.
- **`node theme-lint.mjs contrast`** (task `frontend:contrast`, non-blocking): WCAG contrast report for text-on-surface / on-primary pairs per theme.

App-wide "no hardcoded colours in components" is **not** enforced yet (there are 260+ legacy sites); that's a separate migration. Don't add new hardcoded colours regardless.

## Gotchas

- **`--mantine-*` vars are consumed by Mantine at runtime**, not via our `var()`. A source scan can't see their use — never delete them as "unused", and set them (not raw colours) when overriding Mantine.
- **`--accent-*` (categorical hues) are used dynamically** via `` `var(--accent-${hue})` `` in `utils/accentColors.ts`. A literal search won't find them — don't treat them as unused.
- **Tailwind consumes some vars** (`--gray-*`, `--color-*`, `--background`, `--border`) via `editor/tailwind.config.js` using `rgb(var(--x))`. That file is outside the usual scan roots — check it before removing those.
- **Specificity:** if a token you set in `colors.css` (`html[data-app-theme="custom"]`, 0,1,1) isn't winning, a `:root:root` or a `[data-mantine-color-scheme]`-compound block in the legacy files is probably overriding it — set it in the more specific block.
- **Adding a colour:** put the literal in `primitives.css`, map it to a `--c-*` in `colors.css` if it's a new semantic role, and reference the `--c-*` from components. Don't skip straight to a `--p-*` in a component unless there's genuinely no semantic fit.
