/**
 * NSIS kurulum sihirbazının markalı görsellerini üretir.
 * electron-builder BMP beklediği için sharp çıktısını 24 bit BMP'ye çeviriyoruz.
 */
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const buildDir = path.join(__dirname, '..', 'build');
const { version } = require('../package.json');
const markUri = `data:image/png;base64,${fs.readFileSync(path.join(buildDir, 'orbita-mark.png')).toString('base64')}`;

const SIDEBAR_W = 164;
const SIDEBAR_H = 314;
const HEADER_W = 150;
const HEADER_H = 57;

const mint = '#3ef2b5';

function sidebarSvg() {
  return `<svg width="${SIDEBAR_W}" height="${SIDEBAR_H}" viewBox="0 0 ${SIDEBAR_W} ${SIDEBAR_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1c17"/>
      <stop offset="0.55" stop-color="#06100c"/>
      <stop offset="1" stop-color="#030705"/>
    </linearGradient>
    <linearGradient id="mint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8dffd9"/>
      <stop offset="1" stop-color="#18b98a"/>
    </linearGradient>
  </defs>
  <rect width="${SIDEBAR_W}" height="${SIDEBAR_H}" fill="url(#bg)"/>
  <circle cx="34" cy="40" r="76" fill="${mint}" fill-opacity="0.10"/>
  <circle cx="140" cy="250" r="70" fill="${mint}" fill-opacity="0.05"/>
  <image href="${markUri}" x="32" y="58" width="100" height="100"/>
  <text x="30" y="186" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="#eafff7" letter-spacing="1">ORBITA</text>
  <rect x="30" y="196" width="34" height="3" rx="1.5" fill="${mint}"/>
  <text x="30" y="219" font-family="Segoe UI, Arial, sans-serif" font-size="10.5" fill="#7f9c92">Şirketini tek yerden</text>
  <text x="30" y="234" font-family="Segoe UI, Arial, sans-serif" font-size="10.5" fill="#7f9c92">yönet.</text>
  <circle cx="33" cy="256" r="2" fill="${mint}"/>
  <text x="43" y="260" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#9db6aa">Yerel veri</text>
  <circle cx="33" cy="272" r="2" fill="${mint}"/>
  <text x="43" y="276" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#9db6aa">Arka plan izleme</text>
  <circle cx="33" cy="288" r="2" fill="${mint}"/>
  <text x="43" y="292" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#9db6aa">Şifreli eşitleme</text>
  <text x="30" y="306" font-family="Segoe UI, Arial, sans-serif" font-size="7.5" fill="#4d6a60">Orbita · v${version}</text>
</svg>`;
}

function headerSvg() {
  return `<svg width="${HEADER_W}" height="${HEADER_H}" viewBox="0 0 ${HEADER_W} ${HEADER_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#07110d"/>
      <stop offset="1" stop-color="#04100b"/>
    </linearGradient>
    <linearGradient id="hm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8dffd9"/>
      <stop offset="1" stop-color="#18b98a"/>
    </linearGradient>
  </defs>
  <rect width="${HEADER_W}" height="${HEADER_H}" fill="url(#hb)"/>
  <image href="${markUri}" x="4" y="7" width="42" height="42"/>
  <text x="52" y="27" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#eafff7" letter-spacing="0.8">ORBITA</text>
  <text x="52" y="42" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#7f9c92">WINDOWS · v${version}</text>
</svg>`;
}

/** 24 bit, alt-satır öncelikli BMP yazar (NSIS'in beklediği biçim). */
function writeBmp(file, width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const header = Buffer.alloc(54);
  header.write('BM', 0, 'ascii');
  header.writeUInt32LE(54 + pixelBytes, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixelBytes, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);

  const pixels = Buffer.alloc(pixelBytes);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = (height - 1 - y) * width * 4;
    const targetRow = y * rowSize;
    for (let x = 0; x < width; x += 1) {
      const src = sourceRow + x * 4;
      const dst = targetRow + x * 3;
      pixels[dst] = rgba[src + 2];
      pixels[dst + 1] = rgba[src + 1];
      pixels[dst + 2] = rgba[src];
    }
  }
  fs.writeFileSync(file, Buffer.concat([header, pixels]));
}

async function render(svg, width, height, file) {
  const { data } = await sharp(Buffer.from(svg)).resize(width, height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  writeBmp(file, width, height, data);
  console.log('yazıldı:', path.relative(process.cwd(), file));
}

(async () => {
  fs.mkdirSync(buildDir, { recursive: true });
  await render(sidebarSvg(), SIDEBAR_W, SIDEBAR_H, path.join(buildDir, 'installer-sidebar.bmp'));
  await render(headerSvg(), HEADER_W, HEADER_H, path.join(buildDir, 'installer-header.bmp'));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
