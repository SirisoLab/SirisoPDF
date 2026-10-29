// @vitest-environment node
import { describe, expect, test } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests that all required logo assets exist.
 * This ensures that when useLogoAssets returns paths, those files actually exist.
 */
describe("useLogoAssets - Logo Asset Files", () => {
  const publicDir = path.resolve(__dirname, "../../../../public");
  // Brand logo assets live in core; the editor's vite config copies
  // core/assets/brand/modern-logo/* into the served root at build time (see
  // viteStaticCopy in editor/vite.config.ts), so useLogoAssets can keep
  // referencing them by their public-URL path. Validate them at source.
  const logoDir = path.resolve(__dirname, "../assets/brand/modern-logo");

  // All asset files that useLogoAssets references
  const requiredAssets = [
    "SirisoLogo.png",
    "SirisoPDFWordmarkWhite.svg",
    "SirisoPDFWordmarkBlack.svg",
    "SirisoPDFWordmarkGrey.svg",
    "Firstpage.png",
  ];

  test("logo folder should exist", () => {
    expect(fs.existsSync(logoDir)).toBe(true);
  });

  test.each(requiredAssets)("should have %s", (assetName) => {
    const assetPath = path.join(logoDir, assetName);
    expect(
      fs.existsSync(assetPath),
      `Missing asset: modern-logo/${assetName}`,
    ).toBe(true);
  });

  test("manifest.json should exist", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.name).toBe("Siriso PDF");
    expect(manifest.icons.every((icon: { src: string }) => icon.src.endsWith("SirisoLogo.png"))).toBe(true);
  });
});
