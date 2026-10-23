import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/icons", { recursive: true });
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fdfbf7"/><circle cx="256" cy="256" r="186" fill="#a54b35"/><text x="256" y="357" text-anchor="middle" fill="white" font-family="Georgia,serif" font-size="300">B</text></svg>`,
);
for (const size of [192, 512])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
await sharp(svg).png().toFile("public/icons/maskable-512.png");
await sharp(svg)
  .resize(180, 180)
  .png()
  .toFile("public/icons/apple-touch-icon.png");
