# Distribution notices

The launcher source follows the repository's MIT license. The packaged backend
must be built with the core flavor and `buildWithPortal=false`; commercial,
desktop, cloud, processor and SaaS layers have separate upstream terms.

JCEFMaven 152.0.6 is licensed under Apache-2.0. Its resolved JCEF API and native
bundles carry JCEF/CEF BSD-style licenses and Chromium third-party notices.
Their exact artifacts are pinned by the JCEFMaven POM. Preserve the `lib` JARs,
all licenses and notices within them, and the native archive contents extracted
into the user's versioned JCEF directory. Do not discard native `LICENSE*`,
`NOTICE*` or `credits*` resources when repackaging.

`packageDesktop` includes a generated dependency license report under
`licenses/dependencies`; this is an inventory of declared metadata, not a complete
legal audit. The backend brings further dependencies (including native helpers
when an operator supplies them). Generate the backend's existing dependency
license report for a release, preserve its notices, and separately review any
bundled Java runtime, fonts, converters, OCR data and CEF native resources.

Sources:

- https://github.com/jcefmaven/jcefmaven/blob/master/LICENSE
- https://github.com/chromiumembedded/java-cef/blob/master/LICENSE.txt
- https://github.com/chromiumembedded/cef/blob/master/LICENSE.txt
- https://www.chromium.org/Home/chromium-security/reporting-security-bugs/

CEF is pinned for reproducibility. Review and update the pin with security
releases; this packaging does not install a browser updater.

The Siriso web wordmark uses Syne ExtraBold under SIL OFL 1.1. Its notice is bundled in the backend at static/modern-logo/Syne-OFL.txt; source font and notice are in frontend/src/editor/core/assets/brand/fonts/.
