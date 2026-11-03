/* Manual web QA harness: runs the web build in Electron's Chromium (no preload). */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(process.env.WEB_SHOT_DIR || '.web-shots');
const URL = process.env.WEB_URL || 'http://127.0.0.1:4173/';
const PROFILE = path.join(OUT, 'profile');

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });
app.setPath('userData', PROFILE);
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const logFile = path.join(OUT, 'console.log');
fs.writeFileSync(logFile, '');

function log(line) {
  fs.appendFileSync(logFile, `${line}\n`);
}

async function main() {
  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    show: true,
    backgroundColor: '#050807',
    alwaysOnTop: true,
    webPreferences: { backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');

  win.webContents.on('console-message', (...args) => {
    const details = args[1] && typeof args[1] === 'object' ? args[1] : null;
    const level = details ? details.level : args[1];
    const message = details ? details.message : args[2];
    if (typeof level === 'number' ? level >= 2 : level === 'error' || level === 'warning') {
      log(`[${level}] ${message}`);
    }
  });
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    log(`[did-fail-load] ${code} ${description} ${url}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    log(`[render-process-gone] ${details.reason}`);
  });
  win.webContents.session.on('will-download', (_event, item) => {
    const target = path.join(OUT, 'export.json');
    item.setSavePath(target);
    item.once('done', (_doneEvent, state) => log(`[download] ${state} ${target}`));
  });

  const shot = async (name) => {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        win.show();
        win.focus();
        win.moveTop();
        await delay(150);
        await win.webContents.capturePage();
        const image = await win.webContents.capturePage();
        fs.writeFileSync(path.join(OUT, `${name}.png`), image.toPNG());
        log(`[shot] ${name}`);
        return;
      } catch (error) {
        lastError = error;
        log(`[shot-retry] ${name} ${error && error.message ? error.message : error}`);
        await delay(700);
      }
    }
    throw lastError;
  };

  const js = (code) => win.webContents.executeJavaScript(code, true);
  const nav = async (page) => {
    await js(`document.querySelector('[data-nav="${page}"]')?.click()`);
    await delay(500);
  };
  const textOf = (selector) => js(`document.querySelector(${JSON.stringify(selector)})?.textContent || ''`);
  const fillAuth = (selector, value, index = 0) => js(`
    (() => {
      const input = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `);

  await win.loadURL(URL);
  await delay(1200);
  log(`[auth-gate] ${await js(`Boolean(document.querySelector('.auth-card'))`)}`);
  await shot('00-auth-register');
  await fillAuth('input[autocomplete="name"]', 'QA Test');
  await fillAuth('input[autocomplete="username"]', 'qatester');
  await fillAuth('input[autocomplete="new-password"]', 'QA-Parola-2026!', 0);
  await fillAuth('input[autocomplete="new-password"]', 'QA-Parola-2026!', 1);
  await delay(200);
  await shot('00-auth-register-filled');
  await js(`document.querySelector('form.auth-form')?.requestSubmit()`);
  await delay(1400);
  log(`[auth-registered] ${await js(`document.querySelector('.auth-card') ? 'locked' : 'open'`)}`);
  log(`[auth-error] ${await textOf('.auth-error')}`);
  log(`[sidebar-account] ${await textOf('.sidebar-account-text')}`);
  const authRecord = await js(`
    (() => {
      const raw = localStorage.getItem('ezwin.hub.web.auth.v1');
      if (!raw) return null;
      const account = JSON.parse(raw).account;
      return {
        name: account.name,
        username: account.username,
        iterations: account.iterations,
        hashBytes: atob(account.hash).length,
        saltBytes: atob(account.salt).length,
        hasPlainPassword: raw.includes('QA-Parola-2026!'),
      };
    })()
  `);
  log(`[auth-record] ${JSON.stringify(authRecord)}`);
  const sessionInfo = await js(`(() => ({
    local: Boolean(localStorage.getItem('ezwin.hub.web.session.v1')),
    tab: Boolean(sessionStorage.getItem('ezwin.hub.web.session.v1')),
  }))()`);
  log(`[session-after-register] ${JSON.stringify(sessionInfo)}`);
  await shot('01-dashboard-empty');

  await nav('services');
  await shot('02-services-empty');
  await nav('companies');
  await shot('03-companies-empty');
  await nav('finance');
  await shot('04-finance-empty');
  await nav('tasks');
  await shot('05-tasks-empty');
  await nav('tools');
  await shot('06-tools');
  await nav('settings');
  await shot('07-settings');
  log(`[settings-title] ${await textOf('.page-head h1')}`);
  log(`[settings-text] ${(await textOf('.settings-grid')).slice(0, 500)}`);

  await js(`document.querySelector('.palette-trigger')?.click()`);
  await delay(300);
  const paletteText = await textOf('.palette-list');
  log(`[palette] ${paletteText}`);
  await shot('08-palette');
  await js(`document.querySelector('.palette-backdrop')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await delay(250);

  const seedResult = await js(`
    (async () => {
      const seed = await (await fetch('./seed/ezwin-portfolio.json')).json();
      return { companies: seed.companies.length, assets: seed.assets.length };
    })()
  `);
  log(`[seed-file] ${JSON.stringify(seedResult)}`);

  await js(`document.querySelector('.web-seed-row button')?.click()`);
  await delay(350);
  log(`[seed-confirm] ${await textOf('.confirm-message')}`);
  await js(`document.querySelector('.modal-footer .btn-danger')?.click()`);
  await delay(1900);
  const seededState = await js(`(async () => { const p = await window.ezwin.getInitial(); return { companies: p.state.companies.length, assets: p.state.assets.length }; })()`);
  log(`[seeded-state] ${JSON.stringify(seededState)}`);

  const qaData = await js(`
    (async () => {
      const p = await window.ezwin.getInitial();
      const company = p.state.companies[0];
      const today = new Date().toISOString().slice(0, 10);
      await window.ezwin.finance.create({
        companyId: company.id,
        kind: 'income',
        amount: 1250,
        category: 'Test',
        note: 'QA',
        date: today,
      });
      await window.ezwin.task.create({
        title: 'QA görevi',
        companyId: company.id,
        priority: 'high',
      });
      await window.ezwin.note.create({
        title: 'QA notu',
        body: 'Tarayıcı verisi testi.',
        companyId: company.id,
        pinned: true,
      });
      const next = await window.ezwin.getInitial();
      return {
        tasks: next.state.tasks.length,
        notes: next.state.notes.length,
        finance: next.state.finance.length,
      };
    })()
  `);
  log(`[qa-data] ${JSON.stringify(qaData)}`);
  await js('location.reload()');
  await delay(1600);
  await shot('09-dashboard-seeded');

  await nav('companies');
  await shot('10-companies-seeded');
  await js(`document.querySelector('.company-card')?.click()`);
  await delay(600);
  await shot('11-company-detail');

  await nav('services');
  await shot('12-services-seeded');
  await nav('finance');
  await shot('13-finance-seeded');
  await nav('tasks');
  await shot('14-tasks-seeded');
  await nav('settings');
  await shot('15-settings-seeded');
  log(`[settings-seeded] ${(await textOf('.settings-grid')).slice(0, 700)}`);

  await js(`document.querySelector('.web-data-actions button')?.click()`);
  await delay(800);

  const ratesResult = await js(`
    (async () => {
      try {
        const r = await window.ezwin.rates.refresh();
        return { TRY: r.rates.TRY, EUR: r.rates.EUR, source: r.source, stale: r.stale, date: r.rateDate };
      } catch (error) {
        return { error: String(error) };
      }
    })()
  `);
  log(`[rates] ${JSON.stringify(ratesResult)}`);

  const languageResult = await js(`
    (() => {
      const select = document.querySelector('select[aria-label="Dil"]');
      if (!select) return 'no-language-select';
      select.value = 'en';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value;
    })()
  `);
  log(`[language] ${languageResult}`);
  await delay(900);
  await shot('16-settings-english');
  await nav('dashboard');
  await shot('17-dashboard-english');

  win.setSize(390, 844);
  await delay(600);
  await shot('18-mobile-dashboard');
  await js(`document.querySelector('.web-menu-btn')?.click()`);
  await delay(400);
  await shot('19-mobile-nav');
  await js(`document.querySelector('.web-nav-scrim')?.click()`);
  await delay(300);

  win.setSize(1024, 820);
  await delay(500);
  await nav('settings');
  await shot('20-settings-tablet');

  const exportPath = path.join(OUT, 'export.json');
  if (fs.existsSync(exportPath)) {
    const fileText = fs.readFileSync(exportPath, 'utf8');
    const dispatch = await js(`
      (() => {
        const input = document.querySelector('.web-file-input');
        if (!input) return 'no-input';
        const file = new File([${JSON.stringify(fileText)}], 'export.json', { type: 'application/json' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'dispatched';
      })()
    `);
    log(`[import] ${dispatch}`);
    await delay(450);
    log(`[import-confirm] ${await textOf('.confirm-message')}`);
    await js(`document.querySelector('.modal-footer .btn-danger')?.click()`);
    await delay(1900);
    const imported = await js(`
      (async () => {
        const p = await window.ezwin.getInitial();
        return {
          companies: p.state.companies.length,
          assets: p.state.assets.length,
          tasks: p.state.tasks.length,
          notes: p.state.notes.length,
          finance: p.state.finance.length,
          language: p.state.settings.language,
        };
      })()
    `);
    log(`[imported-state] ${JSON.stringify(imported)}`);

    const created = await js(`
      (async () => {
        const p = await window.ezwin.getInitial();
        const company = p.state.companies[0];
        const next = await window.ezwin.task.create({
          title: 'QA kalıcı görev',
          companyId: company ? company.id : null,
          priority: 'med',
        });
        return next.tasks.length;
      })()
    `);
    log(`[task-create] ${created}`);
    await js('location.reload()');
    await delay(1700);
    const persisted = await js(`
      (async () => {
        const p = await window.ezwin.getInitial();
        return {
          tasks: p.state.tasks.length,
          hasQaTask: p.state.tasks.some((task) => task.title === 'QA kalıcı görev'),
        };
      })()
    `);
    log(`[task-after-reload] ${JSON.stringify(persisted)}`);

    await js(`document.querySelector('.sidebar-account-logout')?.click()`);
    await delay(500);
    log(`[auth-after-logout] ${await js(`Boolean(document.querySelector('.auth-card'))`)}`);
    await shot('21-auth-login');
    log(`[auth-login-account] ${await textOf('.auth-account-text')}`);
    await fillAuth('input[autocomplete="current-password"]', 'yanlis-parola');
    await js(`document.querySelector('form.auth-form')?.requestSubmit()`);
    await delay(900);
    log(`[auth-wrong] ${await textOf('.auth-error')}`);
    await shot('22-auth-error');
    await fillAuth('input[autocomplete="current-password"]', 'QA-Parola-2026!');
    await js(`document.querySelector('form.auth-form')?.requestSubmit()`);
    await delay(1400);
    log(`[auth-relogin] ${await js(`document.querySelector('.auth-card') ? 'locked' : 'open'`)}`);
    const reloginState = await js(`
      (async () => {
        const p = await window.ezwin.getInitial();
        return { companies: p.state.companies.length, tasks: p.state.tasks.length };
      })()
    `);
    log(`[auth-relogin-state] ${JSON.stringify(reloginState)}`);
    await shot('23-dashboard-relogin');

    await js(`document.querySelector('.sidebar-account-logout')?.click()`);
    await delay(500);
    const rememberToggle = await js(`
      (() => {
        const box = document.querySelector('.auth-check input');
        if (!box) return { found: false };
        if (box.checked) box.click();
        return {
          found: true,
          checked: box.checked,
          hint: document.querySelector('.auth-check small')?.textContent || '',
        };
      })()
    `);
    log(`[remember-toggle] ${JSON.stringify(rememberToggle)}`);
    await fillAuth('input[autocomplete="current-password"]', 'QA-Parola-2026!');
    await js(`document.querySelector('form.auth-form')?.requestSubmit()`);
    await delay(1400);
    const tabSession = await js(`(() => ({
      local: Boolean(localStorage.getItem('ezwin.hub.web.session.v1')),
      tab: Boolean(sessionStorage.getItem('ezwin.hub.web.session.v1')),
    }))()`);
    log(`[session-tab] ${JSON.stringify(tabSession)}`);
    await js('location.reload()');
    await delay(1600);
    log(`[tab-session-reload] ${await js(`document.querySelector('.auth-card') ? 'locked' : 'open'`)}`);
    await shot('24-dashboard-tab-session');

    await js(`document.querySelector('.sidebar-account-logout')?.click()`);
    await delay(500);
    await js(`document.querySelector('.auth-link')?.click()`);
    await delay(350);
    await shot('25-auth-reset');
    const beforeReset = await js(`
      (() => {
        const raw = localStorage.getItem('ezwin.hub.web.v1');
        return { companies: raw ? JSON.parse(raw).companies.length : 0 };
      })()
    `);
    await js(`document.querySelector('.auth-reset-actions .btn-danger')?.click()`);
    await delay(700);
    log(`[auth-reset] ${await js(`document.querySelector('.auth-card h2')?.textContent || ''`)}`);
    const afterReset = await js(`
      (() => {
        const raw = localStorage.getItem('ezwin.hub.web.v1');
        return {
          companies: raw ? JSON.parse(raw).companies.length : 0,
          hasAuth: Boolean(localStorage.getItem('ezwin.hub.web.auth.v1')),
        };
      })()
    `);
    log(`[auth-reset-data] ${JSON.stringify({ before: beforeReset, after: afterReset })}`);
    await shot('26-auth-reregister');
    await fillAuth('input[autocomplete="name"]', 'QA Test');
    await fillAuth('input[autocomplete="username"]', 'qatester');
    await fillAuth('input[autocomplete="new-password"]', 'QA-Parola-2026!', 0);
    await fillAuth('input[autocomplete="new-password"]', 'QA-Parola-2026!', 1);
    await js(`document.querySelector('form.auth-form')?.requestSubmit()`);
    await delay(1400);
    log(`[auth-reregistered] ${await js(`document.querySelector('.auth-card') ? 'locked' : 'open'`)}`);
    await shot('27-dashboard-reregister');

    await nav('settings');
    await js(`document.querySelector('.web-danger-zone .btn-danger')?.click()`);
    await delay(350);
    log(`[clear-confirm] ${await textOf('.confirm-message')}`);
    await js(`document.querySelector('.modal-footer .btn-danger')?.click()`);
    await delay(1700);
    const cleared = await js(`localStorage.getItem('ezwin.hub.web.v1') === null`);
    log(`[cleared] ${cleared}`);
  } else {
    log('[import] export.json missing');
  }

  log('[done]');
  app.quit();
}

app.whenReady().then(main).catch((error) => {
  log(`[fatal] ${error && error.stack ? error.stack : error}`);
  app.exit(1);
});
