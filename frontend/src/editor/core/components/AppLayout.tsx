import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useBanner } from "@editor/contexts/BannerContext";
import { stripBasePath } from "@editor/constants/app";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import NavigationWarningModal from "@editor/components/shared/NavigationWarningModal";
import { TitleBarSearch } from "@editor/components/layout/TitleBarSearch";
import { SirisoStickyAdBar } from "@editor/components/shared/siriso/SirisoStickyAdBar";
import { SirisoTopLeaderboardAd } from "@editor/components/shared/siriso/SirisoTopLeaderboardAd";
import { SirisoRightSidebarAd } from "@editor/components/shared/siriso/SirisoRightSidebarAd";
import { SirisoFloatingCornerAd } from "@editor/components/shared/siriso/SirisoFloatingCornerAd";
import { SirisoProModal } from "@editor/components/shared/siriso/SirisoProModal";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * App layout wrapper that handles banner rendering and viewport sizing
 * Automatically adjusts child components to fit remaining space after banner
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { banner } = useBanner();
  const { pathname } = useLocation();
  const { isLandingOpen, canUseWorkspace } = useSirisoPro();
  const path = stripBasePath(pathname);
  const isTestMode = import.meta.env.MODE === "test";
  const showingLanding =
    path === "/welcome" ||
    (!isTestMode && !canUseWorkspace) ||
    (isLandingOpen && (path === "/" || path === ""));

  return (
    <>
      <style>{`
        .h-screen {
          height: 100% !important;
        }
      `}</style>
      <div
        style={{
          height: "var(--titlebar-body-h, 100dvh)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {banner}
        {!showingLanding && <SirisoTopLeaderboardAd />}
        <div style={{ flex: 1, minHeight: 0, height: 0 }}>{children}</div>
      </div>
      {/* Portals Super Search into the title-bar strip when a layer provides one;
          otherwise renders nothing. Kept here so it stays mounted across views. */}
      <TitleBarSearch />
      <NavigationWarningModal />
      {!showingLanding && <SirisoRightSidebarAd />}
      {!showingLanding && <SirisoFloatingCornerAd />}
      {!showingLanding && <SirisoStickyAdBar />}
      <SirisoProModal />
    </>
  );
}
