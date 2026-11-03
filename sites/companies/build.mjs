import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { BRANDS, LOGO_DIR, FONT_DIR, SITE_URL, SITE_HOST, PORTFOLIO_URL, SUPPORT_DISCORD } from './brands.mjs';
import { renderPage, renderCss, renderJs } from './template.mjs';

const HERE = import.meta.dirname;
const REPO = path.resolve(HERE, '..', '..');
const APP_LOGO_DIR = path.join(REPO, 'public', 'company-logos');

const APP_LOGO_NAMES = {
  corporation: 'ezwin-corporation.png',
  fivem: 'ezwin-fivem.png',
  hesap: 'ezwin-hesap-hizmetleri.png',
  'site-sys': 'ezwin-site-sys.png',
  template: 'ezwin-template.png',
  uncopylocked: 'ezwin-uncopylocked.png',
  cheat: 'ezwin-cheat.png',
};

const NET_DESC = {
  corporation: 'Çatı markası',
  fivem: 'FiveM kaynak paketleri',
  hesap: 'Hesap ve erişim hizmetleri',
  'site-sys': 'Site ve panel sistemleri',
  template: 'Roblox şablonları',
  uncopylocked: 'Uncopylocked sahneler',
  cheat: 'Luau test laboratuvarı',
};

const CATEGORY = {
  corporation: 'agency',
  fivem: 'studio',
  hesap: 'store',
  'site-sys': 'studio',
  template: 'platform',
  uncopylocked: 'platform',
  cheat: 'other',
};

const OG_LINE = {
  corporation: 'Stüdyo, ticaret ve topluluk markaları tek çatı altında.',
  fivem: 'QBCore tabanlı FiveM kaynak paketleri ve test sunucusu.',
  hesap: 'Hesap, erişim ve dijital teslim süreçleri tek protokolde.',
  'site-sys': 'Tanıtım siteleri, paneller ve ortak tasarım sistemi.',
  template: 'Menü, HUD ve oyun döngüsü şablonları.',
  uncopylocked: 'Uncopylocked tabanlar, prop setleri ve hazır sahneler.',
  cheat: 'Kendi test ortamınızda Luau davranış analizi.',
};

const APP_DESCRIPTION = {
  corporation: 'EzWin markalarını tek çatı altında toplayan kurum. Stüdyo, ticaret ve topluluk hatları.',
  fivem: 'QBCore tabanlı FiveM kaynak paketleri; oxmysql, PolyZone, spawn seçici, txAdmin ve test sunucusu.',
  hesap: 'Hesap kurulumu, erişim ayarları ve dijital teslim süreçleri; doğrulama odaklı akış.',
  'site-sys': 'Tanıtım siteleri, panel arayüzleri ve ortak tasarım sistemleri üreten web stüdyosu.',
  template: 'Roblox Studio için menü, HUD ve oyun döngüsü şablonları.',
  uncopylocked: 'Roblox Studio için uncopylocked tabanlar, 3D prop setleri ve düzenlenebilir sahneler.',
  cheat: 'Kendi test ortamında Luau davranışını izleyen, ölçen ve raporlayan çalışma alanı.',
};

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrapText(text, limit) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > limit && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

async function makeOg(brand) {
  const logoSrc = path.join(LOGO_DIR, brand.logoFile);
  const logoBuffer = await sharp(logoSrc).resize(360, 360, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
  const logo64 = logoBuffer.toString('base64');
  const bg = brand.theme === 'dossier' ? '#08080a' : brand.theme === 'lab' ? '#09070c' : '#07090b';
  const panel = brand.theme === 'dossier' ? '#0f0f12' : brand.theme === 'lab' ? '#100c15' : '#0d1013';
  const tileBg = brand.logoLight ? '#f4f1ea' : '#0b0d10';
  const firstLine = xml(brand.word[0].toUpperCase());
  const secondLine = xml(brand.word[1].toUpperCase());
  const taglineSvg = `<text x="74" y="476" font-family="Segoe UI, Arial, sans-serif" font-size="25" fill="#9aa1a9">${xml(OG_LINE[brand.slug])}</text>`;
  const nameSize = Math.max(secondLine.length, firstLine.length) > 15 ? 60 : 74;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="glow" cx="82%" cy="12%" r="70%">
        <stop offset="0%" stop-color="${brand.accent}" stop-opacity="0.24"/>
        <stop offset="55%" stop-color="${brand.accent}" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="${brand.accent}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.5" fill="#f4f1ea" fill-opacity="0.12"/>
      </pattern>
      <clipPath id="logoclip"><rect x="884" y="168" width="240" height="240" rx="26"/></clipPath>
    </defs>
    <rect width="1200" height="630" fill="${bg}"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <rect x="0" y="0" width="1200" height="630" fill="url(#dots)" opacity="0.55"/>
    <rect x="0" y="0" width="1200" height="8" fill="${brand.accent}"/>
    <rect x="74" y="86" width="46" height="3" fill="${brand.accent}"/>
    <text x="134" y="96" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="4" fill="#9aa1a9">EZ WIN MARKALARI · 2026</text>
    <text x="74" y="${300}" font-family="Segoe UI, Arial, sans-serif" font-size="${nameSize}" font-weight="800" letter-spacing="-1" fill="#f4f1ea">${firstLine}</text>
    <text x="74" y="${300 + nameSize + 6}" font-family="Segoe UI, Arial, sans-serif" font-size="${nameSize}" font-weight="800" letter-spacing="-1" fill="${brand.accent}">${secondLine}</text>
    <rect x="74" y="414" width="760" height="1" fill="#f4f1ea" fill-opacity="0.12"/>
    ${taglineSvg}
    <text x="74" y="576" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#6f767e">${xml(SITE_HOST(brand))}</text>
    <rect x="884" y="168" width="240" height="240" rx="26" fill="${tileBg}"/>
    <image x="884" y="168" width="240" height="240" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoclip)" xlink:href="data:image/png;base64,${logo64}"/>
    <rect x="884" y="168" width="240" height="240" rx="26" fill="none" stroke="#f4f1ea" stroke-opacity="0.18" stroke-width="2"/>
    <rect x="884" y="446" width="240" height="84" rx="14" fill="${panel}" stroke="#f4f1ea" stroke-opacity="0.12"/>
    <text x="908" y="480" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="2.4" fill="${brand.accent}">EZ WIN MARKASI</text>
    <text x="908" y="506" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#f4f1ea">${xml(NET_DESC[brand.slug])}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function buildBrand(brand) {
  const dir = path.join(HERE, brand.slug);
  const pub = path.join(dir, 'public');
  await fs.mkdir(pub, { recursive: true });
  await fs.mkdir(path.join(pub, 'fonts'), { recursive: true });
  await fs.mkdir(path.join(pub, 'network'), { recursive: true });

  const source = path.join(LOGO_DIR, brand.logoFile);
  await sharp(source).resize(512, 512, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(pub, 'logo.png'));
  await sharp(source).resize(180, 180, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(pub, 'apple-touch-icon.png'));
  await sharp(source).resize(64, 64, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(pub, 'favicon.png'));

  for (const item of BRANDS) {
    const logo = path.join(LOGO_DIR, item.logoFile);
    await sharp(logo).resize(96, 96, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(pub, 'network', `${item.slug}.png`));
  }

  const og = await makeOg(brand);
  await fs.writeFile(path.join(pub, 'og.png'), og);

  for (const file of ['anybody-latin.woff2', 'anybody-latin-ext.woff2', 'archivo-latin.woff2', 'archivo-latin-ext.woff2', 'OFL-Anybody.txt', 'OFL-Archivo.txt']) {
    await fs.copyFile(path.join(FONT_DIR, file), path.join(pub, 'fonts', file));
  }

  await fs.writeFile(path.join(pub, 'index.html'), renderPage(brand), 'utf8');
  await fs.writeFile(path.join(pub, 'styles.css'), renderCss(brand), 'utf8');
  await fs.writeFile(path.join(pub, 'script.js'), renderJs(), 'utf8');

  const url = SITE_URL(brand);
  await fs.writeFile(
    path.join(pub, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(pub, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${url}</loc>\n    <lastmod>2026-11-01</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
    'utf8',
  );

  await fs.writeFile(
    path.join(dir, 'wasmer.toml'),
    `[package]\nname = "ezwinstudio/${brand.app}"\nversion = "0.1.0"\ndescription = "${brand.name} — resmi site"\n\n[dependencies]\n"wasmer/static-web-server" = "^1"\n\n[fs]\n"/public" = "public"\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'app.yaml'),
    `kind: wasmer.io/App.v0\nowner: ezwinstudio\nname: ${brand.app}\npackage: .\nenv:\n  SERVER_FALLBACK_PAGE: /public/index.html\n`,
    'utf8',
  );

  const appLogo = path.join(APP_LOGO_DIR, APP_LOGO_NAMES[brand.slug]);
  await sharp(source).resize(256, 256, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(appLogo);

  console.log(`built ${brand.slug} -> ${path.relative(REPO, dir)}`);
}

async function main() {
  await fs.mkdir(APP_LOGO_DIR, { recursive: true });
  for (const brand of BRANDS) {
    await buildBrand(brand);
  }

  const manifest = BRANDS.map((brand) => ({
    name: brand.name,
    slug: brand.slug,
    app: brand.app,
    url: SITE_URL(brand).replace(/\/$/, ''),
    color: brand.accent,
    category: CATEGORY[brand.slug],
    description: APP_DESCRIPTION[brand.slug],
    appLogo: `company-logos/${APP_LOGO_NAMES[brand.slug]}`,
    siteLogo: `${brand.slug}/public/logo.png`,
  }));
  await fs.writeFile(path.join(HERE, 'manifest.json'), `${JSON.stringify({ generatedAt: '2026-11-01', supportDiscord: SUPPORT_DISCORD, portfolio: PORTFOLIO_URL, brands: manifest }, null, 2)}\n`, 'utf8');
  console.log(`\n${BRANDS.length} site hazır.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
