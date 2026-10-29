# Siriso PDF branding

This fork uses the user-supplied orange ring logo and the display name Siriso PDF.
The original PNG is stored unchanged as
frontend/src/editor/core/assets/brand/modern-logo/SirisoLogo.png.
The same file is included in the CEF launcher resources as siriso-logo.png.

The web logo, theme-specific wordmarks, onboarding, browser title, favicon,
manifest, and localized product labels use Siriso PDF. CEF uses the same icon
for its window and the Siriso PDF window title. The optional visible certificate-signature logo also uses the supplied PNG. Upstream service names,
company/legal notices, URLs, code namespaces, and PDF engine identifiers remain
attributed to their original providers.

Build the complete application normally with:
- python scripts/native/stirling_native.py build
- python scripts/native/stirling_native.py package
- gradlew.bat -p desktop/cef packageDesktop -PbackendJar=../../dist/native/stirling-pdf.jar

The CEF distribution is named siriso-pdf-cef and its launcher is
bin/siriso-pdf-cef.bat on Windows. Its default application data directory is
SirisoPDF-CEF. The native web package sets UI_APPNAMENAVBAR to Siriso PDF;
administrators may edit that environment setting in native.json.

Retain LICENSE and the third-party license notices when redistributing.

## Typography and orange accents

The visible wordmark is uppercase SIRISO PDF in Syne ExtraBold, weight 800.
Syne's wide glyph outlines are bundled as SVG paths, so no system font install,
font request or fallback substitution is needed at runtime. The pinned original
font and SIL OFL notice are under frontend/src/editor/core/assets/brand/fonts/.
Regenerate with scripts/native/generate_siriso_wordmark.py after installing the
optional development dependencies in scripts/native/requirements-branding.txt.

Siriso orange has its own primitive ramp (--p-siriso-orange-*). Semantic primary,
Mantine controls, legacy SUI tokens and editor selection overlays use it in both
schemes. Bright logo orange is #ff7900; controls use #c65300 and light-surface
accent text uses #a34300 for contrast. Existing document ink and user-selectable
annotation/signature pigments retain their document meaning.
