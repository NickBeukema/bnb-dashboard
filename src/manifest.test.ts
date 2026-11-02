// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Manifest = { icons?: { src: string; sizes: string; purpose: string }[] };
const manifest = (): Manifest => JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));

describe("manifest", () => {
  it("is installable as a standalone app", () => {
    const m = manifest();
    expect(m).toMatchObject({ start_url: "/", scope: "/", display: "standalone" });
    const sizes = m.icons?.map((i) => `${i.sizes} ${i.purpose}`);
    expect(sizes).toEqual(
      expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]),
    );
  });

  it("points at icons that exist", () => {
    for (const icon of manifest().icons ?? []) {
      expect({ src: icon.src, exists: existsSync(`public${icon.src}`) }).toEqual({
        src: icon.src,
        exists: true,
      });
    }
  });
});
