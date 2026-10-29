import { useMemo } from "react";
import { useLogoAssets } from "@editor/hooks/useLogoAssets";

/** Siriso logo URLs under the `modern-logo` folder. */
export function useLogoPath(): { dark: string; light: string } {
  const { folderPath } = useLogoAssets();

  return useMemo(
    () => ({
      dark: `${folderPath}/SirisoLogo.png`,
      light: `${folderPath}/SirisoLogo.png`,
    }),
    [folderPath],
  );
}
