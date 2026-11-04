const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const source = path.join(buildDir, 'orbita-logo-source.jpg');
const crop = { left: 113, top: 100, width: 520, height: 520 };

async function transparentMark() {
  if (!fs.existsSync(source)) {
    throw new Error(`Logo kaynağı bulunamadı: ${source}`);
  }
  const { data, info } = await sharp(source)
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const level = Math.max(r, g, b);
    let alpha = Math.max(0, Math.min(1, (level - 11) / 16));
    alpha = Math.pow(alpha, 0.85);
    const divisor = Math.max(alpha, 0.12);
    out[i] = Math.min(255, Math.round(r / divisor));
    out[i + 1] = Math.min(255, Math.round(g / divisor));
    out[i + 2] = Math.min(255, Math.round(b / divisor));
    out[i + 3] = Math.round(alpha * 255);
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(1024, 1024, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function tileSvg() {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tile" x1="120" y1="0" x2="820" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0d1a15"/>
      <stop offset="0.55" stop-color="#070e0b"/>
      <stop offset="1" stop-color="#030605"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.3" cy="0.16" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="228" fill="url(#tile)"/>
  <rect width="1024" height="1024" rx="228" fill="url(#sheen)"/>
  <rect x="6" y="6" width="1012" height="1012" rx="222" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="4"/>
</svg>`;
}

async function main() {
  fs.mkdirSync(path.join(root, 'src', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public', 'brand-icons'), { recursive: true });

  const mark = await transparentMark();
  fs.writeFileSync(path.join(buildDir, 'orbita-mark.png'), mark);

  const mark512 = await sharp(mark).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(root, 'src', 'assets', 'orbita-mark.png'), mark512);
  fs.writeFileSync(path.join(root, 'public', 'brand-icons', 'orbita-mark.png'), mark512);

  const markIcon = await sharp(mark).resize(880, 880, { kernel: 'lanczos3' }).png().toBuffer();
  const icon = await sharp(Buffer.from(tileSvg()))
    .composite([{ input: markIcon, left: 72, top: 72 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(buildDir, 'icon.png'), icon);
  fs.writeFileSync(path.join(root, 'public', 'hub-icon.png'), icon);

  const icon256 = await sharp(icon).resize(256, 256, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(
    path.join(buildDir, 'icon.svg'),
    `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><image width="1024" height="1024" href="data:image/png;base64,${icon256.toString('base64')}"/></svg>`,
  );

  const icon64 = await sharp(icon).resize(64, 64, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(
    path.join(root, 'public', 'hub-icon.svg'),
    `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><image width="64" height="64" href="data:image/png;base64,${icon64.toString('base64')}"/></svg>`,
  );

  fs.mkdirSync(path.join(root, 'electron', 'assets'), { recursive: true });
  fs.copyFileSync(path.join(buildDir, 'icon.png'), path.join(root, 'electron', 'assets', 'icon.png'));

  console.log('Orbita logosu işlendi: build/orbita-mark.png, build/icon.png, favicon kaynağı hazır');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
