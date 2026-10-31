import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@editor/ui/Icon";
import { RailButton } from "@editor/components/shared/quickNav/QuickNavRailBase";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";

/**
 * Siriso entries above the account avatar: the way back to the landing page, and an upgrade
 * prompt for accounts that still see ads. Account details and sign-out live in the avatar menu.
 */
export function QuickNavRailFooterExtensions() {
  const { isAdFree, openProModal, openLandingPage } = useSirisoPro();
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
      {!isAdFree && (
        <RailButton
          label="Upgrade ke Paket Pro — bebas iklan"
          icon={
            <Icon
              name="star"
              size="1.125rem"
              style={{ color: "var(--p-siriso-orange-400)" }}
            />
          }
          onClick={openProModal}
          testId="siriso-pro-button"
        />
      )}
    </>
  );
}
