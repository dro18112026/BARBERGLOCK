// Generates PWA / favicon icons from the brand logo.
// Run: npm run icons   (re-run after replacing public/brand/logo.*)
//
// The logo is black ink on a near-white JPG background, so it's multiplied
// onto the brand "bone" colour: white becomes bone, ink stays ink.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const LOGO = join(root, "public/brand/logo.jpg");
const BONE = "#F4F0E6";
const OUT = join(root, "public/icons");

/**
 * Clean logo: drop the thin border artifact at the edges of the JPG and push
 * its off-white paper (~230) to pure white so it blends invisibly into bone.
 */
const clean = () =>
  sharp(LOGO).extract({ left: 12, top: 14, width: 936, height: 926 }).grayscale().linear(1.12, 0);

/** Logo scaled to `inner` px, centred on a `size` px bone square. */
async function onBone(size, inner, source = clean()) {
  const logo = await source.resize(inner, inner, { fit: "contain", background: "#ffffff" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: BONE } })
    .composite([{ input: logo, blend: "multiply" }])
    .png();
}

/** Square crop of the barber's face — readable at favicon sizes. */
const face = async () =>
  sharp(await clean().toBuffer()).extract({ left: 238, top: 6, width: 470, height: 470 });

await mkdir(OUT, { recursive: true });

// Full logo, small margin ("any" purpose).
await (await onBone(192, 180)).toFile(join(OUT, "icon-192.png"));
await (await onBone(512, 480)).toFile(join(OUT, "icon-512.png"));
// Maskable: launchers crop to a circle/squircle, keep the art in the inner ~80%.
await (await onBone(512, 380)).toFile(join(OUT, "maskable-512.png"));
// iOS home screen (no transparency, iOS rounds the corners itself).
await (await onBone(180, 168)).toFile(join(root, "src/app/apple-icon.png"));
// Browser tab icon: the face only, the full logo is unreadable at 32 px.
await (await onBone(64, 64, await face())).toFile(join(root, "src/app/icon.png"));

// Logo for the website itself (same clean-up, on the page background).
await (await onBone(640, 640)).toFile(join(root, "public/brand/logo-web.png"));

console.log("Icons written to public/icons and src/app/{icon,apple-icon}.png");
