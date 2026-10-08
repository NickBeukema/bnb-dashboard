// Draws the app icons into public/icons. Run with `npm run icons` after changing the design.
// The mark is four staggered stay bars in the property colours, as on the calendar.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BACKGROUND = "#1b2530"; // --primary (light theme)
// Hex versions of the --wavesong, --red-house, --lake-breeze and --nautical-nest tokens
const BARS = [
  { color: "#2460b7", from: 96, to: 330 },
  { color: "#b6322b", from: 196, to: 416 },
  { color: "#057558", from: 136, to: 290 },
  { color: "#f3c443", from: 236, to: 416 },
];

/**
 * @param scale shrinks the bars toward the centre; maskable icons keep them inside the safe zone
 * @param radius corner radius of the background, 0 for full-bleed icons the OS will crop
 */
function svg({ scale = 1, radius = 112 } = {}) {
  const height = 56;
  const gap = 22;
  const top = 256 - (BARS.length * height + (BARS.length - 1) * gap) / 2;
  const bars = BARS.map(
    (b, i) =>
      `<rect x="${b.from}" y="${top + i * (height + gap)}" width="${b.to - b.from}" height="${height}" rx="${height / 2}" fill="${b.color}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BACKGROUND}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${bars}</g>
</svg>
`;
}

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

const png = (source: string, size: number, name: string) =>
  sharp(Buffer.from(source)).resize(size, size).png().toFile(new URL(name, out).pathname);

writeFileSync(new URL("icon.svg", out), svg());
await Promise.all([
  png(svg(), 192, "icon-192.png"),
  png(svg(), 512, "icon-512.png"),
  // Android crops maskable icons to its own shape, so these fill the square
  png(svg({ scale: 0.78, radius: 0 }), 192, "maskable-192.png"),
  png(svg({ scale: 0.78, radius: 0 }), 512, "maskable-512.png"),
  // iOS rounds the corners itself and shows transparency as black
  png(svg({ scale: 0.86, radius: 0 }), 180, "apple-touch-icon.png"),
]);
