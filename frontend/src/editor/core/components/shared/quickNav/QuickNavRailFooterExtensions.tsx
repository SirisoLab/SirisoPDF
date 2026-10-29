import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@editor/ui/Icon";
import { RailButton } from "@editor/components/shared/quickNav/QuickNavRailBase";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";

/** Footer entries for returning to the Siriso PDF Landing Page and managing Siriso Pro */
export function QuickNavRailFooterExtensions() {
  const { isPro, openProModal, openLandingPage } = useSirisoPro();
  const navigate = useNavigate();
  const location = useLocation();

  const handleOpenLanding = () => {
    openLandingPage();
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  return (
    <>
      <RailButton
        label="Halaman Utama & Info Fitur"
        icon={
          <Icon
            name="house"
            size="1.125rem"
            style={{ color: "var(--p-siriso-orange-400)" }}
          />
        }
        onClick={handleOpenLanding}
        testId="siriso-landing-button"
      />
      <RailButton
        label={isPro ? "Siriso Pro Aktif" : "Upgrade ke Siriso Pro"}
        icon={
          <Icon
            name="star"
            size="1.125rem"
            filled={isPro}
            style={{
              color: isPro
                ? "var(--p-amber-400)"
                : "var(--p-siriso-orange-400)",
            }}
          />
        }
        onClick={openProModal}
        testId="siriso-pro-button"
      />
    </>
  );
}
