import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_SOURCE = path.resolve("public/assets/brand-logo-original.png");
const FALLBACK_SOURCE = "C:/Users/DAN/.gemini/antigravity/brain/ed22d5d7-b3a8-4486-a08b-ebc9d1efa9a5/.user_uploaded/media_1792717395590_a4b5b63f.png";
const PUBLIC_DIR = path.resolve("public");
const ASSETS_DIR = path.join(PUBLIC_DIR, "assets");

async function run() {
  await fs.mkdir(ASSETS_DIR, { recursive: true });

  let sourceBuffer;
  try {
    sourceBuffer = await fs.readFile(DEFAULT_SOURCE);
  } catch {
    sourceBuffer = await fs.readFile(FALLBACK_SOURCE);
  }
  const metadata = await sharp(sourceBuffer).metadata();
  console.log("Source metadata:", metadata.width, metadata.height, metadata.format);

  // 1. Master Brand Logo (full 1024x1024)
  await sharp(sourceBuffer)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSETS_DIR, "brand-logo.png"));

  await sharp(sourceBuffer)
    .webp({ quality: 90 })
    .toFile(path.join(ASSETS_DIR, "brand-logo.webp"));

  // 2. Transparent Master Logo
  const fullRaw = await sharp(sourceBuffer).raw().toBuffer({ resolveWithObject: true });
  const fullData = fullRaw.data;
  const bgR = 253, bgG = 231, bgB = 236;

  for (let i = 0; i < fullData.length; i += 4) {
    const r = fullData[i], g = fullData[i+1], b = fullData[i+2];
    const diff = Math.sqrt(Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2));
    if (diff < 16) {
      fullData[i + 3] = 0;
    } else if (diff < 42) {
      fullData[i + 3] = Math.round(((diff - 16) / 26) * 255);
    }
  }

  const fullTransparent = await sharp(fullData, {
    raw: {
      width: fullRaw.info.width,
      height: fullRaw.info.height,
      channels: 4
    }
  }).png().toBuffer();

  await sharp(fullTransparent).png().toFile(path.join(ASSETS_DIR, "brand-logo-transparent.png"));
  await sharp(fullTransparent).webp({ quality: 90 }).toFile(path.join(ASSETS_DIR, "brand-logo-transparent.webp"));

  // 3. Mark Crop (Camera + Makeup Brush)
  // Coordinates from bounding box analysis:
  // markMinX: 221, markMaxX: 899, markMinY: 175, markMaxY: 649
  const markWidth = 899 - 221;
  const markHeight = 649 - 175;
  const paddingX = 40;
  const paddingY = 40;

  const croppedMark = await sharp(sourceBuffer)
    .extract({
      left: Math.max(0, 221 - paddingX),
      top: Math.max(0, 175 - paddingY),
      width: Math.min(1024 - (221 - paddingX), markWidth + paddingX * 2),
      height: Math.min(1024 - (175 - paddingY), markHeight + paddingY * 2)
    })
    .toBuffer();

  // Make square 800x800 with #fce7ec background
  const markSquare = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 253, g: 231, b: 236, alpha: 1 }
    }
  })
    .composite([{ input: croppedMark, gravity: "center" }])
    .png()
    .toBuffer();

  await sharp(markSquare).resize(512, 512).png().toFile(path.join(ASSETS_DIR, "brand-mark.png"));
  await sharp(markSquare).resize(512, 512).webp({ quality: 92 }).toFile(path.join(ASSETS_DIR, "brand-mark.webp"));

  // Transparent mark
  const markRaw = await sharp(markSquare).raw().toBuffer({ resolveWithObject: true });
  const mData = markRaw.data;
  for (let i = 0; i < mData.length; i += 4) {
    const r = mData[i], g = mData[i+1], b = mData[i+2];
    const diff = Math.sqrt(Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2));
    if (diff < 16) {
      mData[i + 3] = 0;
    } else if (diff < 42) {
      mData[i + 3] = Math.round(((diff - 16) / 26) * 255);
    }
  }

  const markTransparent = await sharp(mData, {
    raw: {
      width: markRaw.info.width,
      height: markRaw.info.height,
      channels: 4
    }
  }).png().toBuffer();

  await sharp(markTransparent).resize(512, 512).png().toFile(path.join(ASSETS_DIR, "brand-mark-transparent.png"));
  await sharp(markTransparent).resize(512, 512).webp({ quality: 92 }).toFile(path.join(ASSETS_DIR, "brand-mark-transparent.webp"));

  // 4. PWA Icons
  // Standard PWA icons (any)
  await sharp(markSquare).resize(192, 192).png().toFile(path.join(PUBLIC_DIR, "pwa-192x192.png"));
  await sharp(markSquare).resize(512, 512).png().toFile(path.join(PUBLIC_DIR, "pwa-512x512.png"));

  // Maskable PWA icons (with safe padding)
  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 253, g: 231, b: 236, alpha: 1 }
    }
  })
    .composite([{
      input: await sharp(markSquare).resize(144, 144).toBuffer(),
      gravity: "center"
    }])
    .png()
    .toFile(path.join(PUBLIC_DIR, "pwa-maskable-192x192.png"));

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 253, g: 231, b: 236, alpha: 1 }
    }
  })
    .composite([{
      input: await sharp(markSquare).resize(384, 384).toBuffer(),
      gravity: "center"
    }])
    .png()
    .toFile(path.join(PUBLIC_DIR, "pwa-maskable-512x512.png"));

  // Apple touch icon (180x180)
  await sharp(markSquare).resize(180, 180).png().toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png"));

  // 5. Favicons
  const fav16 = await sharp(markSquare).resize(16, 16).png().toBuffer();
  const fav32 = await sharp(markSquare).resize(32, 32).png().toBuffer();
  const fav48 = await sharp(markSquare).resize(48, 48).png().toBuffer();
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon-16x16.png"), fav16);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon-32x32.png"), fav32);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon-48x48.png"), fav48);

  // Multi-size ICO
  const icoBuffer = createIco([fav16, fav32, fav48], [16, 32, 48]);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), icoBuffer);

  // Favicon SVG
  // High quality vector-embedded SVG that scales cleanly from 16px to 512px
  const favB64 = (await sharp(markSquare).resize(256, 256).png().toBuffer()).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <rect width="256" height="256" rx="56" fill="#fce7ec" />
  <image href="data:image/png;base64,${favB64}" width="256" height="256" preserveAspectRatio="xMidYMid meet" />
</svg>`;
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon.svg"), svg);

  // 6. Marketing / OpenGraph Banner (1200x630)
  const logoBanner = await sharp(sourceBuffer).resize(480, 480).toBuffer();
  const ogOverlaySvg = Buffer.from(`
<svg width="600" height="400" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="90" font-family="'Lora', 'Georgia', serif" font-size="52" font-weight="bold" fill="#992844">BeautyHub</text>
  <text x="0" y="150" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="28" font-weight="600" fill="#2d2424">Đúng người, đúng khoảnh khắc</text>
  <text x="0" y="195" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="20" fill="#6d5854">Nền tảng đặt lịch Photographer &amp; Makeup Artist tại TP.HCM</text>
  <rect x="0" y="245" width="220" height="48" rx="24" fill="#ef6d85" />
  <text x="110" y="276" text-anchor="middle" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="16" font-weight="600" fill="#ffffff">Khám phá creator →</text>
</svg>
`);

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 253, g: 231, b: 236, alpha: 1 }
    }
  })
    .composite([
      { input: logoBanner, left: 80, top: 75 },
      { input: ogOverlaySvg, left: 580, top: 125 }
    ])
    .png({ compressionLevel: 8 })
    .toFile(path.join(ASSETS_DIR, "og-beautyhub.png"));

  await sharp(path.join(ASSETS_DIR, "og-beautyhub.png"))
    .webp({ quality: 85 })
    .toFile(path.join(ASSETS_DIR, "og-beautyhub.webp"));

  console.log("Brand generation completed successfully!");
}

function createIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let currentOffset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(currentOffset, 12);
    entries.push(entry);
    currentOffset += buf.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

run().catch(err => {
  console.error("Asset generation error:", err);
  process.exit(1);
});
