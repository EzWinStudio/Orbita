import { BRANDS, SUPPORT_DISCORD, PORTFOLIO_URL, SITE_HOST, SITE_URL } from './brands.mjs';

const ARROW = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;
const DOWN = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
const EXT = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/></svg>`;

const NET_DESC = {
  corporation: 'Çatı markası',
  fivem: 'FiveM kaynak paketleri',
  hesap: 'Hesap ve erişim hizmetleri',
  'site-sys': 'Site ve panel sistemleri',
  template: 'Roblox şablonları',
  uncopylocked: 'Uncopylocked sahneler',
  cheat: 'Luau test laboratuvarı',
};

const EXISTING = [
  { label: 'EzWin Portfolyo', url: PORTFOLIO_URL },
  { label: 'CATA Store', url: 'https://cata-store.wasmer.app' },
  { label: 'EzWinStudio', url: 'https://ezwinstudio.github.io/EzWinStudio/' },
  { label: 'AniMax', url: 'https://animax.wasmer.app' },
  { label: 'EnterScans', url: 'https://enterscans.wasmer.app' },
  { label: 'EzCraft', url: 'https://ezcraft.wasmer.app' },
  { label: 'EzWinMusic', url: 'https://ezwinmusic.wasmer.app' },
];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function brandTile(brand, size = 40) {
  return `<span class="brand-tile${brand.logoLight ? ' logo-light' : ' logo-dark'}"><img src="logo.png" alt="" width="${size}" height="${size}" /></span>`;
}

function wordmark(brand) {
  const sub = brand.name.replace(/^EZWIN\s+|^EzWin\s+/, '').toUpperCase();
  return `<span class="brand-word" aria-label="${esc(brand.name)}"><b>EZ</b><span class="wm-arrow" aria-hidden="true">→</span><b>WIN</b><em>${esc(sub)}</em></span>`;
}

function button(action, kind = 'primary') {
  const external = action.external
    ? ` target="_blank" rel="noopener noreferrer"`
    : '';
  const icon = action.external ? EXT : ARROW;
  return `<a class="btn btn-${kind}" href="${action.href}"${external}>${esc(action.label)}${icon}</a>`;
}

function head(brand) {
  const url = SITE_URL(brand);
  const desc = esc(brand.description);
  const title = esc(brand.title);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url,
    logo: `${url}logo.png`,
    description: brand.description,
    sameAs: [SUPPORT_DISCORD, PORTFOLIO_URL],
  };
  return `<!doctype html>
<html lang="tr" class="theme-${brand.theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="theme-color" content="${brand.theme === 'dossier' ? '#08080a' : brand.theme === 'lab' ? '#09070c' : '#07090b'}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />

    <meta property="og:type" content="website" />
    <meta property="og:locale" content="tr_TR" />
    <meta property="og:site_name" content="${esc(brand.name)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${url}og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(brand.name)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${url}og.png" />

    <link rel="preload" href="fonts/anybody-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="fonts/anybody-latin-ext.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="fonts/archivo-latin-ext.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="styles.css" />

    <script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>
  </head>
  <body>
    <a class="skip-link" href="#main">İçeriğe geç</a>`;
}

function rail(brand) {
  if (brand.theme !== 'dossier') return '';
  return `<div class="class-rail" aria-hidden="true"><div class="wrap rail-inner"><span>${esc(brand.name)}</span><span>KURUM KAYDI</span><span>TR · 2026</span></div></div>`;
}

function header(brand) {
  const links = brand.nav
    .map((item) => `<a href="${item.href}">${esc(item.label)}</a>`)
    .join('');
  return `${rail(brand)}
    <header class="site-header" data-header>
      <div class="wrap header-inner">
        <a class="brand" href="#top" aria-label="${esc(brand.name)} ana sayfa">
          ${brandTile(brand)}
          ${wordmark(brand)}
        </a>
        <nav class="nav" id="site-nav" aria-label="Ana menü">
          ${links}
        </nav>
        <div class="header-actions">
          <a class="header-discord" href="${SUPPORT_DISCORD}" target="_blank" rel="noopener noreferrer">
            Discord ${EXT}
          </a>
          <button class="menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Menüyü aç">
            <span></span><span></span>
          </button>
        </div>
      </div>
    </header>
    <div class="nav-backdrop" data-nav-backdrop aria-hidden="true"></div>`;
}

function visual(brand) {
  switch (brand.hero.visual) {
    case 'seal':
      return `<aside class="hero-panel panel-seal" data-reveal>
        <div class="panel-top"><span>KURUM KAYDI</span><span class="panel-chip">ÇATI</span></div>
        <div class="seal-stage">
          <span class="seal-ring" aria-hidden="true"></span>
          <img src="logo.png" alt="${esc(brand.name)} logosu" width="220" height="220" />
        </div>
        <dl class="panel-rows">
          <div><dt>Yapı</dt><dd>Çok markalı çatı</dd></div>
          <div><dt>Kapsam</dt><dd>Stüdyo · ticaret · topluluk</dd></div>
          <div><dt>Web</dt><dd>${SITE_HOST(brand)}</dd></div>
        </dl>
        <p class="seal-quote">“WE’RE HERE AND WE’RE PROTECTING YOU”<span>Marka manifestosu</span></p>
      </aside>`;

    case 'spec':
      return `<aside class="hero-panel panel-spec" data-reveal>
        <div class="panel-top"><span>SÜRÜM PROFİLİ</span><span class="panel-chip">FIVEM</span></div>
        <div class="spec-head">
          <span class="spec-logo"><img src="logo.png" alt="" width="56" height="56" /></span>
          <div><b>EzWin FiveM</b><span>Kaynak yığını</span></div>
        </div>
        <dl class="panel-rows spec-rows">
          <div><dt>Çekirdek</dt><dd>QBCore</dd></div>
          <div><dt>Veri</dt><dd>oxmysql</dd></div>
          <div><dt>Bölge</dt><dd>PolyZone</dd></div>
          <div><dt>Spawn</dt><dd>Seçimli başlangıç</dd></div>
          <div><dt>Yönetim</dt><dd>txAdmin</dd></div>
          <div><dt>Gamebuild</dt><dd>3751</dd></div>
        </dl>
        <div class="panel-foot"><span class="led" aria-hidden="true"></span> Test sunucusu ayrı ortamda</div>
      </aside>`;

    case 'protocol':
      return `<aside class="hero-panel panel-protocol" data-reveal>
        <div class="panel-top"><span>HİZMET PROTOKOLÜ</span><span class="panel-chip">4 ADIM</span></div>
        <div class="protocol-head">
          <span class="protocol-logo"><img src="logo.png" alt="" width="52" height="52" /></span>
          <div><b>EzWin Hesap</b><span>Doğrulama odaklı akış</span></div>
        </div>
        <ol class="proto-list">
          <li><span>01</span><b>Talep</b><em>Kapsam yazılır</em></li>
          <li><span>02</span><b>Doğrulama</b><em>Uygunluk kontrolü</em></li>
          <li><span>03</span><b>İşlem</b><em>Karşılıklı onay</em></li>
          <li><span>04</span><b>Teslim</b><em>Kayıt ve destek</em></li>
        </ol>
        <div class="panel-foot">Tüm görüşmeler Discord üzerinden</div>
      </aside>`;

    case 'code':
      return `<aside class="hero-panel panel-code" data-reveal>
        <div class="code-bar">
          <span class="dot dot-red" aria-hidden="true"></span><span class="dot dot-yellow" aria-hidden="true"></span><span class="dot dot-green" aria-hidden="true"></span>
          <b>theme.css</b><span class="panel-chip">BU SAYFA</span>
        </div>
        <pre class="code-body"><code><span class="c-com">/* EzWin Site Sys */</span>
<span class="c-sel">:root</span> {
  <span class="c-key">--accent</span>: <span class="c-val">${brand.accent}</span>;
  <span class="c-key">--surface</span>: <span class="c-val">#0d1013</span>;
  <span class="c-key">--radius</span>: <span class="c-val">18px</span>;
  <span class="c-key">--font-display</span>: <span class="c-val">"Anybody"</span>;
}

<span class="c-sel">.hero</span> {
  <span class="c-key">display</span>: <span class="c-val">grid</span>;
}</code></pre>
        <div class="panel-foot">Yerel font · statik çıktı · harici bağımlılık yok</div>
      </aside>`;

    case 'catalog':
      return `<aside class="hero-panel panel-catalog" data-reveal>
        <div class="panel-top"><span>ŞABLON KATMANLARI</span><span class="panel-chip">STUDIO</span></div>
        <div class="mini-stack">
          <div class="mini mini-menu">
            <span class="mini-title">ANA MENÜ</span>
            <span class="mini-row is-active"></span>
            <span class="mini-row"></span>
            <span class="mini-row"></span>
            <span class="mini-btn"></span>
          </div>
          <div class="mini mini-hud">
            <span class="mini-title">HUD</span>
            <span class="hud-bar"><i style="width:72%"></i></span>
            <span class="hud-bar"><i style="width:46%"></i></span>
            <span class="hud-dots"><i></i><i></i><i></i></span>
          </div>
          <div class="mini mini-loop">
            <span class="mini-title">DÖNGÜ</span>
            <span class="loop-nodes"><i class="is-on"></i><i></i><i></i></span>
            <span class="loop-label">BAŞLANGIÇ → GÖREV → BİTİŞ</span>
          </div>
        </div>
        <div class="panel-foot">Menü · HUD · oyun döngüsü</div>
      </aside>`;

    case 'assets':
      return `<aside class="hero-panel panel-assets" data-reveal>
        <div class="panel-top"><span>SAHNE İÇERİĞİ</span><span class="panel-chip">STUDIO</span></div>
        <div class="asset-grid">
          <div class="asset-tile"><span class="asset-shape shape-base" aria-hidden="true"></span><span>Taban</span></div>
          <div class="asset-tile"><span class="asset-shape shape-prop" aria-hidden="true"></span><span>Prop</span></div>
          <div class="asset-tile"><span class="asset-shape shape-light" aria-hidden="true"></span><span>Işık</span></div>
          <div class="asset-tile"><span class="asset-shape shape-folder" aria-hidden="true"></span><span>Klasör</span></div>
        </div>
        <div class="panel-foot">Düzenlenebilir sahne ve prop setleri</div>
      </aside>`;

    case 'console':
      return `<aside class="hero-panel panel-console" data-reveal>
        <div class="console-bar"><span class="dot dot-live" aria-hidden="true"></span><b>lab.session</b><span class="panel-chip">ÖRNEK ÇIKTI</span></div>
        <div class="console-body">
          <p><span class="c-time">00:01</span><span class="c-tag">init</span> yerel oturum açıldı</p>
          <p><span class="c-time">00:03</span><span class="c-tag">watch</span> remote: Inventory.Open</p>
          <p><span class="c-time">00:07</span><span class="c-tag">measure</span> hareket · 16.2 stud/s</p>
          <p><span class="c-time">00:12</span><span class="c-tag">replay</span> senaryo #04 yeniden çalıştı</p>
          <p><span class="c-time">00:15</span><span class="c-tag">report</span> 12 gözlem kaydedildi</p>
          <p class="console-cursor"><span class="c-time">00:16</span><span class="c-tag">ready</span><span class="cursor" aria-hidden="true"></span></p>
        </div>
        <div class="panel-foot">Yalnızca yerel test ortamı</div>
      </aside>`;

    default:
      return '';
  }
}

function hero(brand) {
  const title = brand.hero.title
    .map((line, index) => {
      const classes = ['title-line'];
      if (index === brand.hero.accentLine) classes.push('is-accent');
      if (index === brand.hero.outlineLine) classes.push('is-outline');
      return `<span class="${classes.join(' ')}">${esc(line)}</span>`;
    })
    .join('');
  const facts = brand.hero.facts
    .map((fact) => `<li><span>${esc(fact.k)}</span><b>${esc(fact.v)}</b></li>`)
    .join('');
  return `<section class="hero" id="top" aria-labelledby="hero-title">
      <div class="hero-aura" aria-hidden="true"></div>
      <div class="hero-grid-bg" aria-hidden="true"></div>
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <p class="eyebrow" data-reveal><span class="eyebrow-mark" aria-hidden="true"></span>${esc(brand.hero.kicker)}</p>
          <h1 class="hero-title" id="hero-title">${title}</h1>
          <p class="hero-lead" data-reveal>${esc(brand.hero.lead)}</p>
          <div class="hero-actions" data-reveal>
            ${button(brand.hero.primary)}
            ${button(brand.hero.secondary, 'ghost')}
          </div>
        </div>
        ${visual(brand)}
      </div>
      <div class="wrap">
        <ul class="facts-strip" data-reveal>${facts}</ul>
      </div>
    </section>`;
}

function sectionHead(no, eyebrow, title, lead) {
  return `<div class="section-head" data-reveal>
    <div class="sec-meta"><span class="sec-index">${esc(no)}</span><span class="sec-eyebrow">${esc(eyebrow)}</span></div>
    <h2>${esc(title)}</h2>
    ${lead ? `<p class="sec-lead">${esc(lead)}</p>` : ''}
  </div>`;
}

function story(brand, no) {
  const s = brand.story;
  const body = s.body
    .map((paragraph, index) => `<p${index === 0 ? ' class="story-lead"' : ''}>${esc(paragraph)}</p>`)
    .join('');
  const aside = s.aside
    .map((row) => `<div><dt>${esc(row.k)}</dt><dd>${esc(row.v)}</dd></div>`)
    .join('');
  return `<section class="section" id="${s.id}" aria-labelledby="${s.id}-title">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <div class="sec-meta"><span class="sec-index">${no}</span><span class="sec-eyebrow">${esc(s.eyebrow)}</span></div>
        <h2 id="${s.id}-title">${esc(s.title)}</h2>
      </div>
      <div class="story-grid">
        <div class="story-body" data-reveal>${body}</div>
        <dl class="story-aside" data-reveal>${aside}</dl>
      </div>
    </div>
  </section>`;
}

function cards(brand, no) {
  const c = brand.cards;
  const items = c.items
    .map(
      (item, index) => `<article class="info-card" data-reveal style="--i:${index}">
        <div class="card-top"><span class="card-no">${esc(item.no)}</span>${ARROW}</div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.body)}</p>
        <ul class="tags">${item.tags.map((tag) => `<li>${esc(tag)}</li>`).join('')}</ul>
      </article>`,
    )
    .join('');
  return `<section class="section" id="${c.id}" aria-labelledby="${c.id}-title">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <div class="sec-meta"><span class="sec-index">${no}</span><span class="sec-eyebrow">${esc(c.eyebrow)}</span></div>
        <h2 id="${c.id}-title">${esc(c.title)}</h2>
        <p class="sec-lead">${esc(c.lead)}</p>
      </div>
      <div class="card-grid">${items}</div>
    </div>
  </section>`;
}

function process(brand, no) {
  const p = brand.process;
  const steps = p.steps
    .map(
      (step, index) => `<li class="process-step" data-reveal>
        <span class="step-no">${String(index + 1).padStart(2, '0')}</span>
        <div class="step-copy"><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p></div>
      </li>`,
    )
    .join('');
  return `<section class="section" id="${p.id}" aria-labelledby="${p.id}-title">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <div class="sec-meta"><span class="sec-index">${no}</span><span class="sec-eyebrow">${esc(p.eyebrow)}</span></div>
        <h2 id="${p.id}-title">${esc(p.title)}</h2>
        <p class="sec-lead">${esc(p.lead)}</p>
      </div>
      <ol class="process-list">${steps}</ol>
    </div>
  </section>`;
}

function note(brand) {
  const n = brand.note;
  const id = brand.slug === 'cheat' ? 'sinir' : 'not';
  return `<section class="section section-note" id="${id}" aria-labelledby="${id}-title">
    <div class="wrap">
      <div class="note-panel ${brand.slug === 'cheat' ? 'note-boundary' : ''}" data-reveal>
        <span class="note-mark" aria-hidden="true">${brand.slug === 'cheat' ? 'SINIR' : 'NOT'}</span>
        <div class="note-copy">
          <span class="note-label">${esc(n.label)}</span>
          <h2 id="${id}-title">${esc(n.title)}</h2>
          <p>${esc(n.body)}</p>
        </div>
      </div>
    </div>
  </section>`;
}

function network(brand) {
  const cards = BRANDS.map((item) => {
    const self = item.slug === brand.slug;
    const href = SITE_URL(item).replace(/\/$/, '');
    return `<a class="network-card${self ? ' is-self' : ''}" href="${href}"${self ? ' aria-current="page"' : ''}>
      <span class="net-logo"><img src="network/${item.slug}.png" alt="" width="56" height="56" /></span>
      <span class="net-copy"><b>${esc(item.name)}</b><span>${esc(NET_DESC[item.slug] ?? '')}</span></span>
      <span class="net-action" aria-hidden="true">${self ? 'BU SAYFA' : ARROW}</span>
    </a>`;
  }).join('');
  return `<section class="section" id="network" aria-labelledby="network-title">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <div class="sec-meta"><span class="sec-index">AĞ</span><span class="sec-eyebrow">EZ WIN MARKALARI</span></div>
        <h2 id="network-title">Ağın diğer markaları.</h2>
        <p class="sec-lead">Yedi marka, tek çatı. Her biri kendi kimliğiyle yayında.</p>
      </div>
      <div class="network-grid">
        ${cards}
        <a class="network-card network-portfolio" href="${PORTFOLIO_URL}" target="_blank" rel="noopener noreferrer">
          <span class="net-logo net-mono" aria-hidden="true">E→W</span>
          <span class="net-copy"><b>EzWin Portfolyo</b><span>Tüm işler ve projeler</span></span>
          <span class="net-action" aria-hidden="true">${EXT}</span>
        </a>
      </div>
    </div>
  </section>`;
}

function cta(brand) {
  const c = brand.cta;
  const external = c.href.startsWith('http');
  return `<section class="section cta-section" id="iletisim" aria-labelledby="cta-title">
    <div class="wrap">
      <div class="cta-band" data-reveal>
        <div class="cta-copy">
          <span class="cta-eyebrow">İLETİŞİM</span>
          <h2 id="cta-title">${esc(c.title)}</h2>
          <p>${esc(c.lead)}</p>
        </div>
        <a class="btn btn-dark btn-lg" href="${c.href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(c.label)}${external ? EXT : ARROW}</a>
      </div>
    </div>
  </section>`;
}

function footer(brand) {
  const networkLinks = BRANDS.map((item) => {
    const self = item.slug === brand.slug;
    return `<li><a href="${SITE_URL(item).replace(/\/$/, '')}"${self ? ' aria-current="page"' : ''}>${esc(item.name)}${self ? ' <em>bu sayfa</em>' : ''}</a></li>`;
  }).join('');
  const existing = EXISTING.map(
    (item) => `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer">${esc(item.label)}${EXT}</a></li>`,
  ).join('');
  return `<footer class="site-footer">
    <div class="wrap footer-grid">
      <div class="footer-brand">
        <a class="brand" href="#top" aria-label="${esc(brand.name)} ana sayfa">${brandTile(brand)}${wordmark(brand)}</a>
        <p>${esc(brand.description)}</p>
        <a class="btn btn-ghost btn-sm" href="${SUPPORT_DISCORD}" target="_blank" rel="noopener noreferrer">Destek Discord ${EXT}</a>
      </div>
      <div class="footer-col">
        <h3>Ağ</h3>
        <ul>${networkLinks}</ul>
      </div>
      <div class="footer-col">
        <h3>EzWin</h3>
        <ul>${existing}</ul>
      </div>
    </div>
    <div class="wrap footer-bottom">
      <p>© <span data-year>2026</span> ${esc(brand.name)}. Tüm hakları saklıdır.</p>
      <p>Statik tanıtım sayfası · ödeme alınmaz · <a href="https://ezwin-site-sys.wasmer.app">EzWin Site Sys</a> ile üretildi</p>
    </div>
  </footer>`;
}

export function renderPage(brand) {
  let n = 0;
  const sections = brand.layout
    .map((kind) => {
      if (kind === 'story') return story(brand, String(++n).padStart(2, '0'));
      if (kind === 'cards') return cards(brand, String(++n).padStart(2, '0'));
      if (kind === 'process') return process(brand, String(++n).padStart(2, '0'));
      if (kind === 'note') return note(brand);
      if (kind === 'network') return network(brand);
      if (kind === 'cta') return cta(brand);
      return '';
    })
    .join('\n');
  return `${head(brand)}
${header(brand)}
    <main id="main">
      ${hero(brand)}
      ${sections}
    </main>
    ${footer(brand)}
    <script src="script.js" defer></script>
  </body>
</html>
`;
}

export function renderCss(brand) {
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
  };
  return `@font-face {
  font-family: "Anybody";
  font-style: normal;
  font-weight: 300 900;
  font-stretch: 75% 125%;
  font-display: swap;
  src: url("fonts/anybody-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308,
    U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113,
    U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: "Anybody";
  font-style: normal;
  font-weight: 300 900;
  font-stretch: 75% 125%;
  font-display: swap;
  src: url("fonts/anybody-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
    U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Archivo";
  font-style: normal;
  font-weight: 400 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("fonts/archivo-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308,
    U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113,
    U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: "Archivo";
  font-style: normal;
  font-weight: 400 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("fonts/archivo-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
    U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

:root {
  --accent: ${brand.accent};
  --accent-2: ${brand.accent2};
  --accent-rgb: ${hexToRgb(brand.accent)};
  --accent-soft: rgba(${hexToRgb(brand.accent)}, 0.12);
  --accent-line: rgba(${hexToRgb(brand.accent)}, 0.35);
  --bg: ${brand.theme === 'dossier' ? '#08080a' : brand.theme === 'lab' ? '#09070c' : '#07090b'};
  --bg-2: ${brand.theme === 'dossier' ? '#0c0c0f' : brand.theme === 'lab' ? '#0d0a11' : '#0a0d10'};
  --panel: ${brand.theme === 'dossier' ? '#0f0f12' : brand.theme === 'lab' ? '#100c15' : '#0d1013'};
  --panel-2: ${brand.theme === 'dossier' ? '#141417' : brand.theme === 'lab' ? '#15101b' : '#111519'};
  --text: #f4f1ea;
  --muted: #9aa1a9;
  --muted-2: #6f767e;
  --line: rgba(244, 241, 234, 0.11);
  --line-strong: rgba(244, 241, 234, 0.22);
  --ink: #08090b;
  --radius: 18px;
  --radius-sm: 12px;
  --wrap: 1240px;
  --header-h: 72px;
  --display: "Anybody", "Arial Black", sans-serif;
  --body: "Archivo", "Segoe UI", sans-serif;
  --hero-size: ${brand.theme === 'dossier' ? 'clamp(2.7rem, 5.2vw, 5.1rem)' : 'clamp(2.4rem, 4.6vw, 4.5rem)'};
  --ease: cubic-bezier(0.22, 0.7, 0.22, 1);
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}
::selection { background: var(--accent); color: var(--ink); }
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }
button { font: inherit; }
h1, h2, h3, p, dl, dd, dt, ul, ol, figure { margin: 0; }
ul, ol { padding: 0; list-style: none; }
h1, h2, h3 {
  font-family: var(--display);
  font-weight: 800;
  font-stretch: 112%;
  line-height: 1.02;
  letter-spacing: -0.015em;
}
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.icon { width: 18px; height: 18px; flex: none; }

.skip-link {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 100;
  padding: 10px 16px;
  background: var(--accent);
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
  transform: translateY(-160%);
  transition: transform 0.2s ease;
}
.skip-link:focus { transform: none; }

.wrap { width: min(calc(100% - 48px), var(--wrap)); margin-inline: auto; }

.class-rail {
  position: relative;
  z-index: 41;
  background: var(--accent);
  color: var(--ink);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}
.rail-inner { display: flex; justify-content: space-between; gap: 16px; padding: 7px 0; }

.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.site-header.is-scrolled { background: color-mix(in srgb, var(--bg) 96%, transparent); border-bottom-color: var(--line); }
.header-inner { display: flex; align-items: center; gap: 28px; min-height: var(--header-h); }
.brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; flex: none; }
.brand-tile {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  flex: none;
}
.brand-tile.logo-light { background: #f4f1ea; }
.brand-tile.logo-dark { background: #0b0d10; }
.brand-tile img { width: 100%; height: 100%; object-fit: cover; }
.brand-word {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  font-family: var(--display);
  font-weight: 900;
  font-stretch: 108%;
  font-size: 18px;
  letter-spacing: 0.01em;
  line-height: 1;
}
.brand-word b { font-weight: 900; }
.wm-arrow { color: var(--accent); font-size: 13px; transform: translateY(-1px); margin: 0 1px; }
.brand-word em {
  font-style: normal;
  font-family: var(--body);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--muted);
  margin-left: 8px;
  transform: translateY(-1px);
}
.nav { display: flex; align-items: center; gap: 26px; margin-left: auto; }
.nav a {
  position: relative;
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 6px 0;
  transition: color 0.18s ease;
}
.nav a::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.22s var(--ease);
}
.nav a:hover { color: var(--text); }
.nav a:hover::after { transform: scaleX(1); }
.header-actions { display: flex; align-items: center; gap: 12px; margin-left: 4px; }
.header-discord {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  color: var(--text);
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  transition: border-color 0.18s ease, color 0.18s ease;
}
.header-discord:hover { border-color: var(--accent); color: var(--accent); }
.header-discord .icon { width: 14px; height: 14px; }
.menu-toggle {
  position: relative;
  display: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  padding: 0;
}
.menu-toggle span {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  width: 18px;
  height: 1.5px;
  margin: 0;
  background: currentColor;
  transform: translate(-50%, calc(-50% - 3px));
  transition: transform 0.2s ease;
}
.menu-toggle span:last-child { transform: translate(-50%, calc(-50% + 3px)); }
.menu-toggle[aria-expanded="true"] span:first-child { transform: translate(-50%, -50%) rotate(45deg); }
.menu-toggle[aria-expanded="true"] span:last-child { transform: translate(-50%, -50%) rotate(-45deg); }

.hero { position: relative; padding: clamp(56px, 8vw, 96px) 0 40px; overflow: hidden; }
.hero-aura {
  position: absolute;
  top: -20%;
  right: -12%;
  width: 760px;
  height: 760px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--accent-rgb), 0.16), transparent 62%);
  filter: blur(30px);
  pointer-events: none;
  animation: aura-drift 18s ease-in-out infinite alternate;
}
.hero-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 72px 72px;
  opacity: 0.28;
  mask-image: radial-gradient(ellipse 70% 70% at 50% 20%, #000 5%, transparent 72%);
  pointer-events: none;
}
.hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.72fr);
  gap: clamp(32px, 5vw, 64px);
  align-items: center;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.eyebrow-mark { width: 20px; height: 2px; background: var(--accent); flex: none; }
.hero-title {
  font-size: var(--hero-size);
  font-weight: 900;
  font-stretch: 92%;
  line-height: 0.96;
  letter-spacing: -0.03em;
  margin-bottom: 26px;
}
.hero-title .title-line { display: block; }
.hero-title .is-accent { color: var(--accent); }
.hero-title .is-outline {
  color: transparent;
  -webkit-text-stroke: 1.5px var(--accent);
  text-stroke: 1.5px var(--accent);
}
.hero-copy { min-width: 0; }
.hero-lead { max-width: 54ch; color: var(--muted); font-size: clamp(15px, 1.35vw, 18px); line-height: 1.65; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 46px;
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid transparent;
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition: transform 0.18s var(--ease), background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}
.btn .icon { width: 16px; height: 16px; }
.btn:hover { transform: translateY(-2px); }
.btn-primary { background: var(--accent); color: var(--ink); }
.btn-primary:hover { box-shadow: 0 14px 34px rgba(var(--accent-rgb), 0.24); }
.btn-ghost { border-color: var(--line-strong); color: var(--text); background: transparent; }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-dark { background: var(--ink); color: var(--text); }
.btn-dark:hover { box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22); }
.btn-sm { min-height: 38px; padding: 9px 15px; font-size: 12px; }
.btn-lg { min-height: 52px; padding: 15px 26px; font-size: 14px; }

.facts-strip {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin-top: clamp(36px, 6vw, 58px);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.facts-strip li { padding: 16px 22px; border-left: 1px solid var(--line); }
.facts-strip li:first-child { border-left: 0; padding-left: 0; }
.facts-strip span { display: block; color: var(--muted-2); font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
.facts-strip b { display: block; margin-top: 5px; font-family: var(--display); font-size: 20px; font-weight: 800; font-stretch: 108%; letter-spacing: 0.01em; }

.hero-panel {
  position: relative;
  background: linear-gradient(155deg, var(--panel-2), var(--panel));
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  padding: 18px;
  box-shadow: 0 34px 80px rgba(0, 0, 0, 0.34);
  animation: panel-in 0.9s var(--ease) 0.1s both;
}
.hero-panel::before {
  content: "";
  position: absolute;
  inset: 0 auto auto 0;
  width: 52px;
  height: 3px;
  background: var(--accent);
  border-radius: var(--radius) 0 0 0;
}
.panel-top, .code-bar, .console-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.panel-chip {
  padding: 3px 8px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  color: var(--accent);
  font-size: 9px;
  letter-spacing: 0.14em;
  white-space: nowrap;
}
.panel-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11.5px;
}
.led { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); flex: none; }
.panel-rows { margin-top: 6px; }
.panel-rows > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.panel-rows > div:last-child { border-bottom: 0; }
.panel-rows dt { color: var(--muted-2); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
.panel-rows dd { color: var(--text); font-size: 12.5px; font-weight: 600; text-align: right; }

.seal-stage {
  position: relative;
  display: grid;
  place-items: center;
  padding: 28px 0 22px;
}
.seal-stage img {
  position: relative;
  z-index: 1;
  width: 210px;
  height: 210px;
  object-fit: cover;
  border-radius: 20px;
  border: 1px solid var(--accent-line);
  filter: grayscale(1) contrast(1.05);
}
.seal-ring {
  position: absolute;
  width: 260px;
  height: 260px;
  border: 1px dashed rgba(var(--accent-rgb), 0.36);
  border-radius: 50%;
  animation: slow-spin 40s linear infinite;
}
.seal-ring::after {
  content: "";
  position: absolute;
  top: 10px;
  left: 50%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
}
.seal-quote {
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--text);
  font-family: var(--display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.4;
}
.seal-quote span { display: block; margin-top: 5px; color: var(--muted-2); font-family: var(--body); font-size: 10px; font-weight: 500; letter-spacing: 0.06em; }

.spec-head, .protocol-head { display: flex; align-items: center; gap: 12px; padding: 18px 0 6px; }
.spec-logo, .protocol-logo { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line-strong); flex: none; }
.spec-logo img, .protocol-logo img { width: 100%; height: 100%; object-fit: cover; }
.spec-head b, .protocol-head b { display: block; font-family: var(--display); font-size: 16px; font-weight: 800; }
.spec-head span, .protocol-head span { display: block; color: var(--muted); font-size: 11px; }
.spec-rows > div { padding: 9px 0; }
.proto-list { margin: 10px 0 14px; }
.proto-list li { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.proto-list li:last-child { border-bottom: 0; }
.proto-list span { color: var(--accent); font-family: var(--display); font-size: 12px; font-weight: 800; }
.proto-list b { font-size: 13px; }
.proto-list em { color: var(--muted); font-style: normal; font-size: 11px; text-align: right; }

.panel-code { padding-bottom: 16px; }
.code-bar { justify-content: flex-start; padding: 0 0 12px; letter-spacing: 0.04em; text-transform: none; }
.console-bar { justify-content: flex-start; }
.console-bar .panel-chip { margin-left: auto; }
.code-bar b { color: var(--text); font-size: 11.5px; font-weight: 600; }
.code-bar .panel-chip { margin-left: auto; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line-strong); flex: none; }
.dot-red { background: #ff5f57; }
.dot-yellow { background: #febc2e; }
.dot-green { background: #28c840; }
.dot-live { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.code-body {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.28);
  color: #d8dee6;
  font-family: "Cascadia Code", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.75;
  overflow-x: auto;
}
.c-com { color: #6b7580; }
.c-sel { color: var(--accent); }
.c-key { color: #9ab8ff; }
.c-val { color: #ffd28a; }

.mini-stack { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 0; }
.mini {
  position: relative;
  overflow: hidden;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
}
.mini-title { display: block; margin-bottom: 9px; color: var(--muted-2); font-size: 8.5px; font-weight: 700; letter-spacing: 0.18em; }
.mini-menu { width: 100%; }
.mini-row { display: block; height: 7px; margin-bottom: 6px; border-radius: 3px; background: var(--line-strong); }
.mini-row.is-active { background: var(--accent); width: 70%; }
.mini-row:nth-of-type(3) { width: 86%; }
.mini-row:nth-of-type(4) { width: 52%; }
.mini-btn { display: block; width: 42%; height: 14px; margin-top: 9px; border-radius: 999px; background: var(--accent); }
.mini-hud { position: static; width: 100%; }
.hud-bar { display: block; height: 5px; margin-bottom: 6px; border-radius: 3px; background: var(--line-strong); overflow: hidden; }
.hud-bar i { display: block; height: 100%; background: var(--accent); }
.hud-dots { display: flex; gap: 5px; margin-top: 8px; }
.hud-dots i { width: 12px; height: 12px; border-radius: 3px; background: var(--line-strong); }
.hud-dots i:first-child { background: var(--accent); }
.mini-loop { grid-column: 1 / -1; width: 100%; }
.loop-nodes { display: flex; align-items: center; gap: 6px; margin: 4px 0 9px; }
.loop-nodes i { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--accent-line); }
.loop-nodes i.is-on { background: var(--accent); }
.loop-nodes i:not(:last-child)::after { content: ""; display: block; width: 22px; height: 1px; background: var(--line-strong); transform: translate(10px, 4px); }
.loop-label { color: var(--muted); font-size: 8.5px; letter-spacing: 0.08em; }

.asset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 0; }
.asset-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 104px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.asset-shape { position: relative; display: block; width: 46px; height: 38px; }
.shape-base { background: linear-gradient(135deg, var(--accent), transparent 85%); clip-path: polygon(50% 0, 100% 82%, 50% 100%, 0 82%); opacity: 0.85; }
.shape-prop { width: 34px; height: 34px; border: 1px solid var(--accent); transform: rotate(45deg) scale(0.82); background: var(--accent-soft); }
.shape-light { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 26px 6px rgba(var(--accent-rgb), 0.4); }
.shape-folder { width: 42px; height: 28px; border: 1px solid var(--accent); border-radius: 4px; margin-top: 8px; background: var(--accent-soft); }
.shape-folder::before { content: ""; position: absolute; top: -8px; left: -1px; width: 18px; height: 8px; border: 1px solid var(--accent); border-bottom: 0; border-radius: 4px 4px 0 0; background: var(--panel); }

.console-body { padding: 14px 2px 8px; font-family: "Cascadia Code", "Consolas", monospace; font-size: 11.5px; line-height: 2.1; }
.console-body p { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; overflow: hidden; color: #cdd3da; }
.c-time { color: var(--muted-2); font-size: 10px; }
.c-tag { min-width: 58px; color: var(--accent); font-size: 10px; }
.cursor { display: inline-block; width: 7px; height: 13px; background: var(--accent); animation: blink 1.1s steps(2, start) infinite; }
.panel-console { background: linear-gradient(155deg, #120d17, #0b090e); }
.panel-console::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px);
  pointer-events: none;
}

.theme-dossier .hero-title .is-outline { -webkit-text-stroke-width: 1.2px; }
.theme-dossier .site-header { border-top: 3px solid var(--accent); }
.theme-lab .hero-grid-bg { opacity: 0.18; background-size: 48px 48px; }
.theme-lab .eyebrow { letter-spacing: 0.24em; }

.section { position: relative; padding: clamp(64px, 9vw, 104px) 0; }
.section + .section { border-top: 1px solid var(--line); }
.section-head {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.65fr);
  gap: 12px clamp(24px, 5vw, 72px);
  align-items: end;
  margin-bottom: clamp(34px, 5vw, 52px);
}
.sec-meta { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; margin-bottom: 2px; }
.sec-index { color: var(--accent); font-family: var(--display); font-size: 12px; font-weight: 800; letter-spacing: 0.08em; }
.sec-eyebrow { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; }
.section-head h2 { font-size: clamp(2rem, 3.6vw, 3.3rem); font-weight: 800; }
.sec-lead { color: var(--muted); font-size: 14.5px; line-height: 1.7; max-width: 46ch; }

.story-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.62fr); gap: clamp(28px, 6vw, 80px); align-items: start; }
.story-body p { color: var(--muted); font-size: 15.5px; line-height: 1.8; max-width: 64ch; }
.story-body p + p { margin-top: 18px; }
.story-body .story-lead { color: var(--text); font-family: var(--display); font-size: clamp(1.2rem, 1.9vw, 1.55rem); font-weight: 500; font-stretch: 102%; line-height: 1.45; letter-spacing: -0.01em; }
.story-aside { border-top: 1px solid var(--line-strong); }
.story-aside > div { display: flex; justify-content: space-between; gap: 20px; padding: 13px 0; border-bottom: 1px solid var(--line); }
.story-aside dt { color: var(--muted-2); font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
.story-aside dd { color: var(--text); font-size: 12.5px; font-weight: 600; text-align: right; }

.card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.info-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 230px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: linear-gradient(160deg, var(--panel), transparent);
  transition: border-color 0.22s ease, transform 0.22s var(--ease), background 0.22s ease;
}
.info-card::before {
  content: "";
  position: absolute;
  top: -1px;
  left: 22px;
  width: 34px;
  height: 2px;
  background: var(--accent);
  transform: scaleX(0.35);
  transform-origin: left;
  transition: transform 0.28s var(--ease);
}
.info-card:hover { border-color: var(--accent-line); transform: translateY(-4px); background: linear-gradient(160deg, var(--panel-2), transparent); }
.info-card:hover::before { transform: scaleX(1); }
.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px; color: var(--muted-2); }
.card-no { color: var(--accent); font-family: var(--display); font-size: 12px; font-weight: 800; letter-spacing: 0.06em; }
.card-top .icon { width: 16px; height: 16px; transition: transform 0.22s ease, color 0.22s ease; }
.info-card:hover .card-top .icon { color: var(--accent); transform: translate(2px, -2px); }
.info-card h3 { margin-bottom: 9px; font-size: 20px; font-weight: 800; }
.info-card p { color: var(--muted); font-size: 13.5px; line-height: 1.65; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 20px; }
.tags li { padding: 4px 8px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted-2); font-size: 9.5px; font-weight: 600; letter-spacing: 0.06em; }

.process-list { border-top: 1px solid var(--line-strong); }
.process-step {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: clamp(16px, 3vw, 36px);
  align-items: start;
  padding: 26px 0;
  border-bottom: 1px solid var(--line);
  transition: padding-left 0.24s var(--ease);
}
.process-step:hover { padding-left: 8px; }
.step-no { color: var(--accent); font-family: var(--display); font-size: clamp(1.7rem, 3vw, 2.5rem); font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
.step-copy { display: grid; grid-template-columns: minmax(150px, 0.5fr) minmax(0, 1fr); gap: 12px 32px; align-items: baseline; }
.step-copy h3 { font-size: 20px; font-weight: 800; }
.step-copy p { color: var(--muted); font-size: 14px; line-height: 1.65; max-width: 58ch; }

.section-note { padding-top: 0; padding-bottom: 0; border-top: 0 !important; }
.note-panel {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: clamp(18px, 4vw, 44px);
  align-items: start;
  padding: clamp(24px, 4vw, 38px);
  border: 1px solid var(--line-strong);
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: linear-gradient(100deg, var(--accent-soft), transparent 55%);
}
.note-mark { color: var(--accent); font-family: var(--display); font-size: 13px; font-weight: 900; letter-spacing: 0.16em; }
.note-label { display: block; margin-bottom: 10px; color: var(--accent); font-size: 9.5px; font-weight: 700; letter-spacing: 0.2em; }
.note-copy h2 { font-size: clamp(1.5rem, 2.8vw, 2.3rem); margin-bottom: 12px; }
.note-copy p { color: var(--muted); font-size: 14px; line-height: 1.7; max-width: 78ch; }
.note-boundary { border-left-color: var(--accent); background: linear-gradient(100deg, rgba(var(--accent-rgb), 0.14), transparent 60%); }

.network-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.network-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  text-decoration: none;
  background: var(--panel);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s var(--ease);
}
.network-card:hover { border-color: var(--accent-line); background: var(--panel-2); transform: translateY(-2px); }
.network-card.is-self { border-color: var(--accent-line); background: linear-gradient(100deg, var(--accent-soft), var(--panel)); }
.net-logo { width: 46px; height: 46px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-strong); flex: none; background: #0b0d10; }
.net-logo img { width: 100%; height: 100%; object-fit: cover; }
.net-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.net-copy b { font-family: var(--display); font-size: 14px; font-weight: 800; letter-spacing: 0.01em; }
.net-copy span { color: var(--muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.net-action { margin-left: auto; color: var(--muted-2); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; display: inline-flex; align-items: center; }
.network-card:hover .net-action { color: var(--accent); }
.net-action .icon { width: 15px; height: 15px; }
.net-mono { display: grid; place-items: center; color: var(--accent); font-family: var(--display); font-size: 14px; font-weight: 900; background: var(--bg-2); }
.network-portfolio .net-copy b { color: var(--text); }

.cta-section { padding-bottom: clamp(64px, 9vw, 104px); }
.cta-band {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding: clamp(30px, 5.5vw, 58px);
  border-radius: var(--radius);
  background: var(--accent);
  color: var(--ink);
}
.cta-band::after {
  content: "";
  position: absolute;
  right: -80px;
  bottom: -120px;
  width: 380px;
  height: 380px;
  border: 1px solid rgba(8, 9, 11, 0.22);
  border-radius: 50%;
  box-shadow: 0 0 0 42px rgba(8, 9, 11, 0.06), 0 0 0 84px rgba(8, 9, 11, 0.04);
  pointer-events: none;
}
.cta-copy { position: relative; z-index: 1; max-width: 700px; }
.cta-eyebrow { display: block; margin-bottom: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.22em; }
.cta-copy h2 { font-size: clamp(1.9rem, 3.5vw, 3rem); margin-bottom: 10px; color: var(--ink); }
.cta-copy p { color: rgba(8, 9, 11, 0.72); font-size: 14px; max-width: 52ch; }
.cta-band .btn { position: relative; z-index: 1; flex: none; }

.site-footer { border-top: 1px solid var(--line); padding: clamp(48px, 7vw, 72px) 0 24px; background: var(--bg-2); }
.footer-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(180px, 0.6fr) minmax(180px, 0.6fr); gap: clamp(28px, 5vw, 64px); }
.footer-brand p { color: var(--muted); font-size: 13px; line-height: 1.65; max-width: 42ch; margin: 16px 0 18px; }
.footer-brand .brand-word em { color: var(--muted); }
.footer-col h3 { margin-bottom: 14px; color: var(--muted-2); font-family: var(--body); font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
.footer-col li + li { margin-top: 9px; }
.footer-col a { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12.5px; text-decoration: none; transition: color 0.16s ease; }
.footer-col a:hover { color: var(--accent); }
.footer-col a em { color: var(--accent); font-style: normal; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
.footer-col .icon { width: 11px; height: 11px; opacity: 0.55; }
.footer-bottom { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: clamp(34px, 5vw, 52px); padding-top: 18px; border-top: 1px solid var(--line); }
.footer-bottom p { color: var(--muted-2); font-size: 10.5px; }
.footer-bottom a { color: var(--muted); text-decoration: none; }
.footer-bottom a:hover { color: var(--accent); }

[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); transition-delay: calc(var(--i, 0) * 45ms); }
[data-reveal].is-in { opacity: 1; transform: none; }

@keyframes panel-in { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes aura-drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-40px, 30px, 0) scale(1.06); } }
@keyframes slow-spin { to { transform: rotate(360deg); } }
@keyframes blink { 0%, 45% { opacity: 1; } 46%, 100% { opacity: 0; } }

@media (max-width: 980px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-panel { max-width: 560px; }
  .hero { padding-top: 48px; }
  .section-head { grid-template-columns: 1fr; }
  .sec-lead { max-width: 64ch; }
  .story-grid { grid-template-columns: 1fr; }
  .story-aside { max-width: 560px; }
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .footer-brand { grid-column: 1 / -1; }
  .nav { display: none; }
  .menu-toggle { display: grid; }
  .site-header[data-open="true"] .nav {
    display: flex;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 10px 24px 18px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    box-shadow: 0 24px 40px rgba(0, 0, 0, 0.3);
  }
  .site-header[data-open="true"] .nav a { width: 100%; padding: 13px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
  .site-header[data-open="true"] .nav a:last-child { border-bottom: 0; }
  .header-discord { display: none; }
  .nav-backdrop {
    display: block;
    position: fixed;
    inset: var(--header-h) 0 0;
    background: rgba(0, 0, 0, 0.62);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 39;
  }
  .nav-backdrop.is-open { opacity: 1; pointer-events: auto; }
}

@media (max-width: 680px) {
  .wrap { width: min(calc(100% - 32px), var(--wrap)); }
  .brand-word em { font-size: 8px; letter-spacing: 0.14em; margin-left: 6px; max-width: 118px; overflow: hidden; text-overflow: ellipsis; }
  .facts-strip { grid-template-columns: 1fr 1fr; }
  .facts-strip li { padding: 13px 14px; }
  .facts-strip li:nth-child(odd) { border-left: 0; padding-left: 0; }
  .facts-strip li:nth-child(n + 3) { border-top: 1px solid var(--line); }
  .card-grid { grid-template-columns: 1fr; }
  .info-card { min-height: 0; }
  .step-copy { grid-template-columns: 1fr; gap: 6px; }
  .process-step { grid-template-columns: 54px 1fr; }
  .network-grid { grid-template-columns: 1fr; }
  .note-panel { grid-template-columns: 1fr; gap: 14px; }
  .cta-band { flex-direction: column; align-items: flex-start; }
  .cta-band .btn { align-self: stretch; }
  .footer-grid { grid-template-columns: 1fr; }
  .footer-bottom { flex-direction: column; gap: 6px; }
  .hero-title .is-outline { -webkit-text-stroke-width: 1px; }
  .seal-stage img { width: 170px; height: 170px; }
  .seal-ring { width: 214px; height: 214px; }
  .mini-stack { grid-template-columns: 1fr; }
  .mini-loop { grid-column: auto; }
  .console-body p { font-size: 10.5px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  [data-reveal] { opacity: 1; transform: none; }
}
`;
}

export function renderJs() {
  return `(() => {
  const header = document.querySelector('[data-header]');
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('[data-menu-toggle]');
  const backdrop = document.querySelector('[data-nav-backdrop]');

  const setOpen = (open) => {
    if (!toggle || !header) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    header.dataset.open = String(open);
    backdrop?.classList.toggle('is-open', open);
  };

  if (toggle && header) {
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    backdrop?.addEventListener('click', () => setOpen(false));
    document.addEventListener('click', (event) => {
      if (header.dataset.open !== 'true') return;
      if (header.contains(event.target)) return;
      setOpen(false);
    });
  }

  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const reveals = document.querySelectorAll('[data-reveal]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach((element) => element.classList.add('is-in'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((element) => observer.observe(element));
  }

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
})();
`;
}
