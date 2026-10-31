import { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import HomePage from "@editor/pages/HomePage";
import { LoadingFallback } from "@editor/components/shared/LoadingFallback";
import { stripBasePath } from "@editor/constants/app";
import { DOCS_PATH, HAS_DOCS } from "@editor/routes/docsRoute";
import { StartupPrompts } from "@editor/components/startup/StartupPrompts";
import { usePdfEngineWarmUp } from "@editor/hooks/usePdfEngineWarmUp";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { SirisoLandingPage } from "@editor/components/shared/siriso/SirisoLandingPage";

// Their own chunks: the settings tree (admin sections, account, licence flows)
// and the docs manifest are both large, and most sessions open neither.
const SettingsPage = lazy(() => import("@editor/pages/SettingsPage"));
const DocsPage = lazy(() => import("@editor/components/docs/DocsPage"));

function AppContent() {
  const { pathname } = useLocation();
  const { isLandingOpen, canUseWorkspace, isAdmin } = useSirisoPro();
  const path = stripBasePath(pathname);
  const isTestMode = import.meta.env.MODE === "test";

  if (!isTestMode && !canUseWorkspace) {
    return <SirisoLandingPage />;
  }

  if (path.startsWith("/settings")) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SettingsPage />
      </Suspense>
    );
  }

  // Developer documentation is for Siriso admins only; everyone else falls through to the editor.
  if (HAS_DOCS && isAdmin && path.startsWith(DOCS_PATH)) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <DocsPage />
      </Suspense>
    );
  }

  if (path === "/welcome" || (isLandingOpen && (path === "/" || path === ""))) {
    return <SirisoLandingPage />;
  }

  return <HomePage />;
}

/** The editor's authenticated or login-disabled routes, including catch-all entries. */
export function AppRoot() {
  usePdfEngineWarmUp();
  return (
    <>
      <StartupPrompts />
      <AppContent />
    </>
  );
}
