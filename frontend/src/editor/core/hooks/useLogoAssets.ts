import { useMemo } from "react";
import { BASE_PATH } from "@editor/constants/app";

const LOGO_FOLDER = "modern-logo";

export function useLogoAssets() {
  return useMemo(() => {
    const folderPath = `${BASE_PATH}/${LOGO_FOLDER}`;

    return {
      folderPath,
      getAssetPath: (name: string) => `${folderPath}/${name}`,
      wordmark: {
        black: `${folderPath}/SirisoPDFWordmarkBlack.svg`,
        grey: `${folderPath}/SirisoPDFWordmarkGrey.svg`,
        white: `${folderPath}/SirisoPDFWordmarkWhite.svg`,
      },
      tooltipLogo: `${folderPath}/SirisoLogo.png`,
      firstPage: `${folderPath}/Firstpage.png`,
      favicon: `${folderPath}/SirisoLogo.png`,
      logo192: `${folderPath}/SirisoLogo.png`,
      logo512: `${folderPath}/SirisoLogo.png`,
      manifestHref: `${BASE_PATH}/manifest.json`,
    };
  }, []);
}
