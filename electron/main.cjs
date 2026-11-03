'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, session, Notification, protocol } = require('electron');
const { Store, toRendererState, youtubeKeySecretId } = require('./store.cjs');
const secrets = require('./secrets.cjs');
const { Monitor } = require('./monitor.cjs');
const mail = require('./mail.cjs');
const rates = require('./rates.cjs');
const youtube = require('./youtube.cjs');
const { Accounts } = require('./accounts.cjs');
const platforms = require('./connections.cjs');
const musicLibrary = require('./music.cjs');
const translate = require('./translate.cjs');
const updates = require('./updates.cjs');
const assistant = require('./assistant.cjs');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ezwin-audio',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false },
  },
]);

app.setName('EZWIN HUB');
app.setAppUserModelId('com.ezwin.hub');

const userDataOverride = process.env.EZWIN_USER_DATA;
if (userDataOverride) {
  app.setPath('userData', path.resolve(userDataOverride));
} else {
  app.setPath('userData', path.join(app.getPath('appData'), 'EZWIN HUB'));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}

let win = null;
let store = null;
let monitor = null;
let youtubeMonitor = null;
let accounts = null;
let activeAccount = null;
let updateTimer = null;
let pendingUpdate = null;

const WINDOW_THEMES = {
  night: { bg: '#050807', bar: '#050807', symbol: '#8ea39a' },
  violet: { bg: '#07060d', bar: '#07060d', symbol: '#b3a6c4' },
  ice: { bg: '#04090d', bar: '#04090d', symbol: '#9ab4c0' },
  lime: { bg: '#070906', bar: '#070906', symbol: '#a3b096' },
};

function normalizeTheme(value) {
  return Object.prototype.hasOwnProperty.call(WINDOW_THEMES, value) ? value : 'night';
}

function applyWindowTheme() {
  if (!win || win.isDestroyed() || !store) return;
  const chrome = WINDOW_THEMES[normalizeTheme(store.get().settings.theme)];
  try {
    win.setBackgroundColor(chrome.bg);
  } catch {
    /* ignore window chrome failures */
  }
  if (win.isFullScreen()) return;
  try {
    win.setTitleBarOverlay({ color: chrome.bar, symbolColor: chrome.symbol, height: 40 });
  } catch {
    /* ignore window chrome failures */
  }
}

function notifyFullscreen(value) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('window:fullscreen', value);
  }
}

function notifyMaximized(value) {
  if (!store) return;
  const settings = store.get().settings;
  if (settings.maximized !== value) {
    settings.maximized = value;
    store.save();
  }
  if (win && !win.isDestroyed()) {
    win.webContents.send('window:maximized', value);
  }
}

function bootstrap() {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    accounts = new Accounts(app.getPath('userData'));
    rates.init(app.getPath('userData'));

    const resumed = accounts.resume();
    if (resumed) startSession(resumed, { startMonitors: false });

    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    registerAudioProtocol();
    registerIpc();
    createWindow();
    applyLoginItemSetting();

    if (resumed && !process.env.EZWIN_SCREENSHOT_DIR) startMonitors();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (monitor) monitor.stop();
    if (youtubeMonitor) youtubeMonitor.stop();
    if (store) store.flushNow();
    app.quit();
  });

  app.on('before-quit', () => {
    if (monitor) monitor.stop();
    if (youtubeMonitor) youtubeMonitor.stop();
    if (store) store.flushNow();
  });
}

function profileDirOf() {
  return path.dirname(store.file);
}

function createMonitors() {
  monitor = new Monitor({
    store,
    intervalSec: store.get().settings.pollIntervalSec,
    onStatuses: (statuses) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('status:changed', statuses);
      }
    },
    onTransition: (asset, previous, next) => {
      if (previous.state === 'offline' || next.state !== 'offline') return;
      if (!store.get().settings.notifications || !Notification.isSupported()) return;
      const company = store.get().companies.find((item) => item.id === asset.companyId);
      const notification = new Notification({
        title: 'Servis çalışmıyor',
        body: `${asset.name}${company ? ` · ${company.name}` : ''} — ${next.error || next.summary || 'Yanıt yok'}`,
      });
      notification.on('click', () => {
        if (win && !win.isDestroyed()) {
          win.show();
          win.focus();
        }
      });
      notification.show();
    },
  });

  youtubeMonitor = new youtube.YoutubeMonitor({
    store,
    onUpdate: (payload) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('youtube:update', payload);
      }
    },
  });
}

function startMonitors() {
  if (monitor) monitor.start();
  if (youtubeMonitor) youtubeMonitor.start();
}

function stopMonitors() {
  if (monitor) monitor.stop();
  if (youtubeMonitor) youtubeMonitor.stop();
}

function startSession(account, options = {}) {
  stopMonitors();
  if (store) store.flushNow();
  activeAccount = account;
  store = new Store(accounts.profileDir(account.id));
  createMonitors();
  applyWindowTheme();
  if (options.startMonitors !== false && !process.env.EZWIN_SCREENSHOT_DIR) startMonitors();
  scheduleUpdateCheck();
  return account;
}

function endSession() {
  stopMonitors();
  if (store) store.flushNow();
  store = null;
  monitor = null;
  youtubeMonitor = null;
  activeAccount = null;
  scheduleUpdateCheck();
}

function scheduleUpdateCheck() {
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  if (!store) return;
  const settings = store.get().settings;
  if (!settings.autoUpdate) return;

  const tick = async () => {
    updateTimer = null;
    if (!store) return;
    try {
      const feed = store.get().settings.updateFeedUrl || updates.DEFAULT_FEED_URL;
      const result = await updates.checkFeed(feed, app.getVersion());
      if (result.available && win && !win.isDestroyed()) {
        win.webContents.send('updates:available', result);
      }
    } catch (err) {
      console.error('[updates]', err.message);
    }
    if (store && store.get().settings.autoUpdate) {
      updateTimer = setTimeout(tick, 6 * 60 * 60 * 1000);
    }
  };

  updateTimer = setTimeout(tick, 20 * 1000);
}

function registerAudioProtocol() {
  protocol.handle('ezwin-audio', async (request) => {
    try {
      if (!store) return new Response('Oturum kapalı.', { status: 401 });
      const url = new URL(request.url);
      const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const track = store.get().playlist.find((item) => item.id === id);
      if (!track) return new Response('Parça bulunamadı.', { status: 404 });

      const filePath = musicLibrary.trackPath(profileDirOf(), track.file);
      if (!fs.existsSync(filePath)) return new Response('Dosya bulunamadı.', { status: 410 });

      const stat = fs.statSync(filePath);
      const headers = {
        'content-type': track.mime || 'audio/mpeg',
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      };
      const range = request.headers.get('range');

      if (!range) {
        const stream = fs.createReadStream(filePath);
        return new Response(Readable.toWeb(stream), {
          headers: { ...headers, 'content-length': String(stat.size) },
        });
      }

      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        return new Response(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isFinite(start) || start > end || start >= stat.size) {
        return new Response(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
      }

      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream), {
        status: 206,
        headers: {
          ...headers,
          'content-length': String(end - start + 1),
          'content-range': `bytes ${start}-${end}/${stat.size}`,
        },
      });
    } catch (err) {
      console.error('[audio]', err.message);
      return new Response('Ses okunamadı.', { status: 500 });
    }
  });
}

function createWindow() {
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const theme = normalizeTheme(store ? store.get().settings.theme : 'night');
  const chrome = WINDOW_THEMES[theme];

  win = new BrowserWindow({
    width: 1536,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: chrome.bg,
    show: false,
    title: 'EZWIN HUB',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: chrome.bar,
      symbolColor: chrome.symbol,
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: true,
      backgroundThrottling: !process.env.EZWIN_SCREENSHOT_DIR,
    },
  });

  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => {
    if (store && store.get().settings.maximized) win.maximize();
    win.show();
  });

  win.on('maximize', () => {
    if (!win.isFullScreen()) notifyMaximized(true);
  });
  win.on('unmaximize', () => {
    if (!win.isFullScreen()) notifyMaximized(false);
  });
  win.on('enter-full-screen', () => notifyFullscreen(true));
  win.on('leave-full-screen', () => {
    applyWindowTheme();
    notifyFullscreen(false);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL || '';
    const allowed = isDev ? url.startsWith(devUrl) : url.startsWith('file:');
    if (!allowed) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
      return;
    }
    if (input.key === 'Escape' && win.isFullScreen()) {
      event.preventDefault();
      win.setFullScreen(false);
      return;
    }
    if (isDev && input.key === 'F12') {
      event.preventDefault();
      win.webContents.toggleDevTools();
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.once('did-finish-load', () => {
    if (isDev || process.env.EZWIN_SCREENSHOT_DIR) {
      win.webContents.on('console-message', (event) => {
        if (event && event.message) console.log('[renderer]', event.message);
      });
    }
    if (process.env.EZWIN_SCREENSHOT_DIR) {
      captureScreens().catch((err) => {
        console.error('[screenshot]', err);
        app.quit();
      });
    }
  });
}

async function captureScreens() {
  const dir = process.env.EZWIN_SCREENSHOT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  await delay(Number(process.env.EZWIN_SCREENSHOT_DELAY_MS) || 3200);
  const language = (process.env.EZWIN_SCREENSHOT_LANGUAGE || '').trim();
  if (language) {
    await win.webContents.executeJavaScript(
      `window.ezwin.settings.update({ language: ${JSON.stringify(language)} })`,
      true,
    );
    await new Promise((resolve) => {
      win.webContents.once('did-finish-load', resolve);
      win.webContents.reload();
    });
    await delay(2600);
  }
  const pages = (process.env.EZWIN_SCREENSHOT_PAGES || 'dashboard,services,companies,finance,tasks,settings')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const reloadSettings = async () => {
    await new Promise((resolve) => {
      win.webContents.once('did-finish-load', resolve);
      win.webContents.reload();
    });
    await delay(2600);
    await win.webContents.executeJavaScript(
      `(() => { const el = document.querySelector('[data-nav="settings"]'); if (el) el.click(); })()`,
      true,
    );
    await delay(600);
    await win.webContents.executeJavaScript(
      `(() => { document.querySelector('.main')?.scrollTo({ top: 0 }); })()`,
      true,
    );
    await delay(200);
  };

  for (const page of pages) {
    const themePage = page.match(/^settings-(night|violet|ice|lime)$/);
    const motionPage = page === 'settings-motion';
    const maximizedPage = page === 'settings-maximized';
    const uiThemePage = page === 'settings-ui-violet';
    const f11Page = page === 'settings-f11';
    const linksPage = page === 'dashboard-links';
    const tasksDonePage = page === 'tasks-done';
    const steps =
      themePage || motionPage || maximizedPage || uiThemePage || f11Page
        ? ['[data-nav="settings"]']
        : linksPage
          ? ['[data-nav="dashboard"]', 'scroll:.link-list']
          : tasksDonePage
            ? ['[data-nav="tasks"]']
            : page === 'connections-guide'
              ? ['[data-nav="connections"]', '.connection-card .btn-primary']
              : page === 'company'
        ? ['[data-nav="companies"]', '[data-company-open]']
        : page === 'company-youtube'
          ? ['[data-nav="companies"]', '[data-company-open]', 'scroll:.youtube-card']
          : page === 'settings-youtube'
            ? ['[data-nav="settings"]', 'scroll:.youtube-key-card']
            : page === 'asset-modal'
              ? ['[data-nav="services"]', '.page-actions .btn-primary']
              : page === 'company-modal'
                ? ['[data-nav="companies"]', '.page-actions .btn-primary']
                : page === 'entry-modal'
                  ? ['[data-nav="finance"]', '.page-actions .btn-primary']
                  : page === 'mail-account-modal'
                    ? ['[data-nav="mail"]', '.page-actions .btn-primary']
                    : page === 'mail-account-edit'
                      ? ['[data-nav="mail"]', '.mail-account-edit']
                      : page === 'mail-reader'
                      ? ['[data-nav="mail"]', '.mail-item']
                      : page === 'palette'
                    ? ['.palette-trigger']
                    : [`[data-nav="${page}"]`];

    let clicked = true;
    for (const selector of steps) {
      if (selector.startsWith('scroll:')) {
        const target = selector.slice('scroll:'.length);
        clicked = await win.webContents.executeJavaScript(
          `(() => { const el = document.querySelector(${JSON.stringify(target)}); if (!el) return false; el.scrollIntoView({ block: 'start' }); return true; })()`,
          true,
        );
      } else {
        clicked = await win.webContents.executeJavaScript(
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.click(); return Boolean(el); })()`,
          true,
        );
      }
      await delay(500);
    }
    if (tasksDonePage) {
      await win.webContents.executeJavaScript(
        `(() => { const el = document.querySelectorAll('.segment')[1]; if (el) el.click(); return Boolean(el); })()`,
        true,
      );
      await delay(600);
    }
    if (themePage) {
      await win.webContents.executeJavaScript(
        `window.ezwin.settings.update({ theme: ${JSON.stringify(themePage[1])} })`,
        true,
      );
      await reloadSettings();
    }
    if (motionPage) {
      await win.webContents.executeJavaScript(
        `window.ezwin.settings.update({ reduceMotion: true })`,
        true,
      );
      await reloadSettings();
    }
    if (maximizedPage) {
      await win.webContents.executeJavaScript(
        `window.ezwin.settings.update({ maximized: true })`,
        true,
      );
      await delay(700);
      console.log(
        `[screenshot] maximized=${win.isMaximized()} bounds=${JSON.stringify(win.getBounds())}`,
      );
      await reloadSettings();
    }
    if (uiThemePage) {
      await win.webContents.executeJavaScript(
        `(() => { const el = document.querySelector('.theme-option:nth-child(2)'); if (el) el.click(); return Boolean(el); })()`,
        true,
      );
      await delay(700);
    }
    if (f11Page) {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F11' });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F11' });
      await delay(900);
    }
    const heading = await win.webContents.executeJavaScript(
      `(() => document.querySelector('.page-heading h1, .company-hero-text h1')?.textContent || '')()`,
      true,
    );
    console.log(`[screenshot] ${page} · clicked=${clicked} · heading=${heading}`);
    await delay(900);
    await win.webContents.capturePage();
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${page}.png`), image.toPNG());
  }
  if (pages.includes('settings-maximized')) {
    await win.webContents.executeJavaScript(
      `window.ezwin.settings.update({ maximized: false })`,
      true,
    );
    await delay(700);
    console.log(
      `[screenshot] restored=${!win.isMaximized()} bounds=${JSON.stringify(win.getBounds())}`,
    );
  }
  if (process.env.EZWIN_SCREENSHOT_EXIT === '1') {
    app.quit();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  return { ok: false, error: typeof error === 'string' ? error : error && error.message ? error.message : 'İşlem başarısız.' };
}

const PUBLIC_CHANNELS = new Set([
  'session:get',
  'account:register',
  'account:login',
  'account:2fa-verify',
  'account:logout',
  'updates:notes',
]);

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      if (!store && !PUBLIC_CHANNELS.has(channel)) {
        throw new Error('Oturum kapalı. Yeniden giriş yap.');
      }
      return ok(await fn(payload || {}));
    } catch (err) {
      console.error(`[ipc:${channel}]`, err.message);
      return fail(err);
    }
  });
}

function current() {
  return toRendererState(store.get());
}

function text(value, max, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} boş olamaz.`);
  }
  const clean = value.trim();
  if (clean.length > max) throw new Error(`${field} en fazla ${max} karakter olabilir.`);
  return clean;
}

function optionalText(value, max, field) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`${field} metin olmalı.`);
  const clean = value.trim();
  if (clean.length > max) throw new Error(`${field} en fazla ${max} karakter olabilir.`);
  return clean;
}

function validId(value, field = 'Kimlik') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{6,64}$/.test(value)) {
    throw new Error(`${field} geçersiz.`);
  }
  return value;
}

function validColor(value) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error('Renk #RRGGBB biçiminde olmalı.');
  }
  return value.toLowerCase();
}

function validUrl(value) {
  let raw = text(value, 600, 'URL');
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) raw = `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Geçerli bir URL gir.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Yalnızca http:// veya https:// adresleri kullanılabilir.');
  }
  return parsed.toString();
}

function validEmail(value) {
  const email = text(value, 254, 'Gmail adresi').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Geçerli bir Gmail adresi gir.');
  }
  return email;
}

function mailPassword(value) {
  if (typeof value !== 'string') throw new Error('Gmail uygulama şifresi gerekli.');
  const password = value.replace(/\s+/g, '');
  if (password.length < 8 || password.length > 64) {
    throw new Error('Gmail uygulama şifresi geçersiz.');
  }
  return password;
}

const MAIL_COLORS = ['#3ef2b5', '#5fc6ff', '#b98bff', '#ffc857', '#ff8fd8', '#a8ff60', '#ff8a1e', '#9fe8d9'];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Geçerli bir tarih seç.');
  }
  if (!Number.isFinite(Date.parse(`${value}T00:00:00`))) {
    throw new Error('Geçerli bir tarih seç.');
  }
  return value;
}

function validCompanyStatus(value) {
  if (!['active', 'maintenance', 'paused'].includes(value)) {
    throw new Error('Geçersiz şirket durumu.');
  }
  return value;
}

function validCompanyCategory(value) {
  if (!['studio', 'platform', 'game', 'agency', 'store', 'music', 'other'].includes(value)) {
    throw new Error('Geçersiz şirket kategorisi.');
  }
  return value;
}

function optionalTarget(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new Error('Aylık hedef 0’dan büyük geçerli bir tutar olmalı.');
  }
  return Math.round(amount * 100) / 100;
}

function findCompany(companyId) {
  const company = store.get().companies.find((c) => c.id === companyId);
  if (!company) throw new Error('Şirket bulunamadı.');
  return company;
}

function findYoutubeKey(id) {
  const key = store.get().youtubeKeys.find((item) => item.id === id);
  if (!key) throw new Error('YouTube API anahtarı bulunamadı.');
  return key;
}

function findConnection(id) {
  const connection = store.get().connections.find((item) => item.id === String(id || ''));
  if (!connection) throw new Error('Bağlantı bulunamadı.');
  return connection;
}

/**
 * Jetonu platformun kendi API'sine sorar ve dönen gerçek profil/istatistikleri
 * bağlantıya yazar. Hata fırlatmaz: sonuç bağlantının durumuna işlenir.
 */
async function verifyStoredConnection(connection) {
  const secret = store.get().secrets[connection.id];
  if (!secret || !secret.enc) throw new Error('Bu hesabın jetonu bulunamadı; yeniden ekle.');

  let token;
  try {
    token = secrets.decrypt(secret.enc);
  } catch (err) {
    connection.status = 'needs_attention';
    connection.lastError = err.message;
    connection.updatedAt = Date.now();
    store.save();
    return;
  }

  try {
    const profile = await platforms.fetchProfile(connection.platform, token);
    if (/^.+ hesabı \d+$/.test(connection.label)) connection.label = profile.name;
    connection.externalId = profile.externalId;
    connection.handle = profile.handle;
    connection.avatar = profile.avatar;
    connection.meta = profile.meta || {};
    connection.status = 'active';
    connection.lastError = null;
  } catch (err) {
    connection.status = 'needs_attention';
    connection.lastError = err.message;
  }
  connection.updatedAt = Date.now();
  store.save();
}

function sanitizeLinks(links) {
  if (!Array.isArray(links)) return [];
  if (links.length > 24) throw new Error('En fazla 24 bağlantı ekleyebilirsin.');
  return links.map((link, index) => {
    if (!link || typeof link !== 'object') throw new Error(`${index + 1}. bağlantı geçersiz.`);
    return {
      id: validId(link.id || `link_${Date.now()}_${index}`, 'Bağlantı kimliği'),
      label: text(link.label, 60, 'Bağlantı adı'),
      url: validUrl(link.url),
    };
  });
}

function sanitizeAssetConfig(type, config) {
  const cfg = config || {};
  if (type === 'website') {
    return { url: validUrl(cfg.url) };
  }
  if (type === 'pterodactyl') {
    return { baseUrl: validUrl(cfg.baseUrl).replace(/\/+$/, '') };
  }
  if (type === 'discord') {
    return {};
  }
  throw new Error('Geçersiz servis türü.');
}

function applyLoginItemSetting() {
  try {
    if (!store) return;
    const desired = Boolean(store.get().settings.openAtLogin);
    const currentSetting = app.getLoginItemSettings().openAtLogin;
    if (desired !== currentSetting) {
      app.setLoginItemSettings({ openAtLogin: desired, path: process.execPath });
    }
  } catch (err) {
    console.error('[login-item]', err.message);
  }
}

function registerIpc() {
  handle('state:get', async () => ({
    state: current(),
    meta: {
      appVersion: app.getVersion(),
      secureStorage: await secrets.isAvailable(),
      dataPath: store.file,
      platform: process.platform,
    },
  }));

  handle('rates:get', () => rates.get(false));
  handle('rates:refresh', () => rates.get(true));

  handle('company:create', (payload) => {
    const company = {
      id: crypto.randomUUID(),
      name: text(payload.name, 60, 'Şirket adı'),
      color: payload.color ? validColor(payload.color) : '#3ef2b5',
      logo: null,
      description: optionalText(payload.description, 180, 'Açıklama'),
      status: payload.status !== undefined ? validCompanyStatus(payload.status) : 'active',
      category: payload.category !== undefined ? validCompanyCategory(payload.category) : 'other',
      monthlyTarget: optionalTarget(payload.monthlyTarget),
      links: sanitizeLinks(payload.links),
      createdAt: Date.now(),
    };
    store.get().companies.unshift(company);
    store.save();
    return current();
  });

  handle('company:update', (payload) => {
    const id = validId(payload.id, 'Şirket kimliği');
    const company = findCompany(id);
    if (payload.name !== undefined) company.name = text(payload.name, 60, 'Şirket adı');
    if (payload.color !== undefined) company.color = validColor(payload.color);
    if (payload.description !== undefined) {
      company.description = optionalText(payload.description, 180, 'Açıklama');
    }
    if (payload.status !== undefined) company.status = validCompanyStatus(payload.status);
    if (payload.category !== undefined) company.category = validCompanyCategory(payload.category);
    if (payload.monthlyTarget !== undefined) {
      company.monthlyTarget = optionalTarget(payload.monthlyTarget);
    }
    if (payload.links !== undefined) company.links = sanitizeLinks(payload.links);
    store.save();
    return current();
  });

  handle('company:delete', (payload) => {
    const id = validId(payload.id, 'Şirket kimliği');
    findCompany(id);
    const state = store.get();
    const assetIds = state.assets.filter((a) => a.companyId === id).map((a) => a.id);
    for (const assetId of assetIds) {
      delete state.secrets[assetId];
      delete state.statuses[assetId];
    }
    state.assets = state.assets.filter((a) => a.companyId !== id);
    const youtubeChannelIds = state.youtubeChannels
      .filter((channel) => channel.companyId === id)
      .map((channel) => channel.channelId);
    state.youtubeChannels = state.youtubeChannels.filter((channel) => channel.companyId !== id);
    state.youtubeEvents = state.youtubeEvents.filter(
      (event) => event.companyId !== id && !youtubeChannelIds.includes(event.channelId),
    );
    state.tasks = state.tasks.filter((t) => t.companyId !== id);
    state.notes = state.notes.filter((n) => n.companyId !== id);
    state.finance = state.finance.filter((f) => f.companyId !== id);
    state.companies = state.companies.filter((c) => c.id !== id);
    store.save();
    return current();
  });

  handle('asset:create', (payload) => {
    const type = payload.type;
    if (!['discord', 'pterodactyl', 'website'].includes(type)) {
      throw new Error('Geçersiz servis türü.');
    }
    const companyId = validId(payload.companyId, 'Şirket');
    findCompany(companyId);
    const config = sanitizeAssetConfig(type, payload.config);
    const asset = {
      id: crypto.randomUUID(),
      companyId,
      type,
      name: text(payload.name, 60, 'Servis adı'),
      config,
      createdAt: Date.now(),
    };

    if (type === 'discord' || type === 'pterodactyl') {
      const token = text(payload.secret, 1000, 'API anahtarı');
      store.get().secrets[asset.id] = {
        enc: secrets.encrypt(token),
        hint: secrets.makeHint(token),
      };
    }

    store.get().assets.unshift(asset);
    delete store.get().statuses[asset.id];
    store.save();
    monitor.checkOne(asset).catch((err) => console.error('[monitor:create]', err.message));
    return current();
  });

  handle('asset:update', (payload) => {
    const id = validId(payload.id, 'Servis kimliği');
    const asset = store.get().assets.find((a) => a.id === id);
    if (!asset) throw new Error('Servis bulunamadı.');
    let configChanged = false;
    if (payload.name !== undefined) asset.name = text(payload.name, 60, 'Servis adı');
    if (payload.companyId !== undefined) {
      validId(payload.companyId, 'Şirket');
      findCompany(payload.companyId);
      asset.companyId = payload.companyId;
    }
    if (payload.config !== undefined) {
      const nextConfig = sanitizeAssetConfig(asset.type, payload.config);
      configChanged = JSON.stringify(nextConfig) !== JSON.stringify(asset.config);
      asset.config = nextConfig;
    }
    if (payload.secret && typeof payload.secret === 'string' && payload.secret.trim()) {
      const token = text(payload.secret, 1000, 'API anahtarı');
      store.get().secrets[asset.id] = {
        enc: secrets.encrypt(token),
        hint: secrets.makeHint(token),
      };
      delete store.get().statuses[asset.id];
      monitor.checkOne(asset).catch((err) => console.error('[monitor:update]', err.message));
    } else if (payload.removeSecret === true) {
      delete store.get().secrets[asset.id];
      delete store.get().statuses[asset.id];
    } else if (configChanged) {
      delete store.get().statuses[asset.id];
      monitor.checkOne(asset).catch((err) => console.error('[monitor:config]', err.message));
    }
    store.save();
    return current();
  });

  handle('asset:delete', (payload) => {
    const id = validId(payload.id, 'Servis kimliği');
    const state = store.get();
    state.assets = state.assets.filter((a) => a.id !== id);
    delete state.secrets[id];
    delete state.statuses[id];
    store.save();
    return current();
  });

  handle('asset:test', async (payload) => {
    if (!['discord', 'pterodactyl', 'website'].includes(payload.type)) {
      throw new Error('Geçersiz servis türü.');
    }
    const config = sanitizeAssetConfig(payload.type, payload.config);
    const token =
      typeof payload.secret === 'string' && payload.secret.trim() ? payload.secret.trim() : null;
    const assetId = payload.assetId ? validId(payload.assetId, 'Servis kimliği') : null;
    return monitor.test({ type: payload.type, config, token, assetId });
  });

  handle('task:create', (payload) => {
    const task = {
      id: crypto.randomUUID(),
      title: text(payload.title, 200, 'Görev'),
      companyId: payload.companyId ? validId(payload.companyId, 'Şirket') : null,
      priority: ['low', 'med', 'high'].includes(payload.priority) ? payload.priority : 'med',
      due: payload.due ? validDate(payload.due) : null,
      done: false,
      createdAt: Date.now(),
    };
    if (task.companyId) findCompany(task.companyId);
    store.get().tasks.unshift(task);
    store.save();
    return current();
  });

  handle('task:update', (payload) => {
    const id = validId(payload.id, 'Görev kimliği');
    const task = store.get().tasks.find((t) => t.id === id);
    if (!task) throw new Error('Görev bulunamadı.');
    if (payload.title !== undefined) task.title = text(payload.title, 200, 'Görev');
    if (payload.companyId !== undefined) {
      if (payload.companyId) {
        validId(payload.companyId, 'Şirket');
        findCompany(payload.companyId);
        task.companyId = payload.companyId;
      } else {
        task.companyId = null;
      }
    }
    if (payload.priority !== undefined) {
      if (!['low', 'med', 'high'].includes(payload.priority)) throw new Error('Geçersiz öncelik.');
      task.priority = payload.priority;
    }
    if (payload.due !== undefined) task.due = payload.due ? validDate(payload.due) : null;
    if (payload.done !== undefined) task.done = Boolean(payload.done);
    store.save();
    return current();
  });

  handle('task:delete', (payload) => {
    const id = validId(payload.id, 'Görev kimliği');
    store.get().tasks = store.get().tasks.filter((t) => t.id !== id);
    store.save();
    return current();
  });

  handle('note:create', (payload) => {
    const note = {
      id: crypto.randomUUID(),
      title: optionalText(payload.title, 120, 'Not başlığı') || 'Adsız not',
      body: optionalText(payload.body, 20000, 'Not içeriği'),
      companyId: payload.companyId ? validId(payload.companyId, 'Şirket') : null,
      pinned: Boolean(payload.pinned),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (note.companyId) findCompany(note.companyId);
    store.get().notes.unshift(note);
    store.save();
    return current();
  });

  handle('note:update', (payload) => {
    const id = validId(payload.id, 'Not kimliği');
    const note = store.get().notes.find((n) => n.id === id);
    if (!note) throw new Error('Not bulunamadı.');
    if (payload.title !== undefined) {
      note.title = optionalText(payload.title, 120, 'Not başlığı') || 'Adsız not';
    }
    if (payload.body !== undefined) note.body = optionalText(payload.body, 20000, 'Not içeriği');
    if (payload.companyId !== undefined) {
      if (payload.companyId) {
        validId(payload.companyId, 'Şirket');
        findCompany(payload.companyId);
        note.companyId = payload.companyId;
      } else {
        note.companyId = null;
      }
    }
    if (payload.pinned !== undefined) note.pinned = Boolean(payload.pinned);
    note.updatedAt = Date.now();
    store.save();
    return current();
  });

  handle('note:delete', (payload) => {
    const id = validId(payload.id, 'Not kimliği');
    store.get().notes = store.get().notes.filter((n) => n.id !== id);
    store.save();
    return current();
  });

  handle('finance:create', (payload) => {
    const companyId = validId(payload.companyId, 'Şirket');
    findCompany(companyId);
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      throw new Error('Geçerli bir tutar gir.');
    }
    const entry = {
      id: crypto.randomUUID(),
      companyId,
      kind: payload.kind === 'expense' ? 'expense' : 'income',
      amount: Math.round(amount * 100) / 100,
      category: optionalText(payload.category, 40, 'Kategori') || 'Genel',
      note: optionalText(payload.note, 240, 'Açıklama'),
      date: validDate(payload.date),
      createdAt: Date.now(),
    };
    store.get().finance.unshift(entry);
    store.save();
    return current();
  });

  handle('finance:delete', (payload) => {
    const id = validId(payload.id, 'Kayıt kimliği');
    store.get().finance = store.get().finance.filter((f) => f.id !== id);
    store.save();
    return current();
  });

  handle('settings:update', (payload) => {
    const settings = store.get().settings;
    if (payload.currency !== undefined) {
      if (!['TRY', 'USD', 'EUR'].includes(payload.currency)) throw new Error('Geçersiz para birimi.');
      settings.currency = payload.currency;
    }
    if (payload.language !== undefined) {
      if (!['tr', 'en', 'de', 'es', 'fr', 'pt', 'ru', 'ar', 'zh', 'ja'].includes(payload.language)) {
        throw new Error('Geçersiz dil.');
      }
      settings.language = payload.language;
    }
    if (payload.pollIntervalSec !== undefined) {
      const interval = Number(payload.pollIntervalSec);
      if (!Number.isFinite(interval) || interval < 30 || interval > 3600) {
        throw new Error('Kontrol aralığı 30–3600 saniye arasında olmalı.');
      }
      settings.pollIntervalSec = Math.round(interval);
      monitor.restart(settings.pollIntervalSec);
    }
    if (payload.openAtLogin !== undefined) {
      settings.openAtLogin = Boolean(payload.openAtLogin);
      applyLoginItemSetting();
    }
    if (payload.clockFormat !== undefined) {
      if (!['24h', '12h'].includes(payload.clockFormat)) throw new Error('Geçersiz saat biçimi.');
      settings.clockFormat = payload.clockFormat;
    }
    if (payload.showSeconds !== undefined) {
      settings.showSeconds = Boolean(payload.showSeconds);
    }
    if (payload.startPage !== undefined) {
      const pages = ['dashboard', 'services', 'companies', 'mail', 'finance', 'tasks', 'tools'];
      if (!pages.includes(payload.startPage)) throw new Error('Geçersiz başlangıç sayfası.');
      settings.startPage = payload.startPage;
    }
    if (payload.notifications !== undefined) {
      settings.notifications = Boolean(payload.notifications);
    }
    if (payload.theme !== undefined) {
      if (!['night', 'violet', 'ice', 'lime'].includes(payload.theme)) {
        throw new Error('Geçersiz tema.');
      }
      settings.theme = payload.theme;
      applyWindowTheme();
    }
    if (payload.maximized !== undefined) {
      settings.maximized = Boolean(payload.maximized);
      if (win && !win.isDestroyed()) {
        if (settings.maximized && !win.isMaximized()) win.maximize();
        else if (!settings.maximized && win.isMaximized()) win.unmaximize();
      }
    }
    if (payload.reduceMotion !== undefined) {
      settings.reduceMotion = Boolean(payload.reduceMotion);
    }
    if (payload.translateSource !== undefined) {
      const value = String(payload.translateSource);
      if (!/^[a-z]{2,3}$|^auto$/.test(value)) throw new Error('Geçersiz kaynak dil.');
      settings.translateSource = value;
    }
    if (payload.translateTarget !== undefined) {
      const value = String(payload.translateTarget);
      if (!/^[a-z]{2,3}$/.test(value)) throw new Error('Geçersiz hedef dil.');
      settings.translateTarget = value;
    }
    if (payload.musicVolume !== undefined) {
      const volume = Number(payload.musicVolume);
      if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
        throw new Error('Ses düzeyi 0 ile 1 arasında olmalı.');
      }
      settings.musicVolume = Math.round(volume * 100) / 100;
    }
    store.save();
    return current();
  });

  handle('settings:test-notification', () => {
    if (!Notification.isSupported()) {
      throw new Error('Bildirimler bu cihazda desteklenmiyor.');
    }
    new Notification({
      title: 'EZWIN HUB',
      body: 'Masaüstü bildirimleri çalışıyor.',
    }).show();
    return true;
  });

  handle('mail:accounts', () => current().mailAccounts);

  handle('mail:test', async (payload) => {
    return mail.test(validEmail(payload.email), mailPassword(payload.password));
  });

  handle('mail:add', async (payload) => {
    if (!(await secrets.isAvailable())) {
      throw new Error('Windows güvenli depolama kullanılamıyor. Gmail şifresi kaydedilemez.');
    }
    const state = store.get();
    const email = validEmail(payload.email);
    if (state.mailAccounts.some((account) => account.email === email)) {
      throw new Error('Bu Gmail adresi zaten bağlı.');
    }
    const label =
      payload.label !== undefined && String(payload.label).trim()
        ? text(payload.label, 40, 'Hesap adı')
        : email.split('@')[0];
    const password = mailPassword(payload.password);
    const result = await mail.test(email, password);
    if (!result.ok) throw new Error(result.message);
    const encrypted = secrets.encrypt(password);
    const account = {
      id: crypto.randomUUID(),
      label,
      email,
      provider: 'gmail',
      color: MAIL_COLORS[state.mailAccounts.length % MAIL_COLORS.length],
      createdAt: Date.now(),
      lastSyncAt: null,
      lastError: null,
    };
    state.mailAccounts.push(account);
    state.secrets[account.id] = { enc: encrypted, hint: '••••' };
    store.save();
    return current().mailAccounts;
  });

  handle('mail:update', async (payload) => {
    const state = store.get();
    const id = validId(payload.id, 'Hesap kimliği');
    const account = state.mailAccounts.find((item) => item.id === id);
    if (!account) throw new Error('Gmail hesabı bulunamadı.');
    let nextLabel = account.label;
    let nextColor = account.color;
    let nextSecret = null;
    if (payload.label !== undefined) {
      nextLabel = String(payload.label).trim()
        ? text(payload.label, 40, 'Hesap adı')
        : account.email.split('@')[0];
    }
    if (payload.color !== undefined) nextColor = validColor(payload.color);
    if (payload.password !== undefined && String(payload.password).trim()) {
      if (!(await secrets.isAvailable())) {
        throw new Error('Windows güvenli depolama kullanılamıyor. Gmail şifresi kaydedilemez.');
      }
      const password = mailPassword(payload.password);
      const result = await mail.test(account.email, password);
      if (!result.ok) throw new Error(result.message);
      nextSecret = secrets.encrypt(password);
    }
    account.label = nextLabel;
    account.color = nextColor;
    if (nextSecret) {
      state.secrets[account.id] = { enc: nextSecret, hint: '••••' };
      account.lastError = null;
      account.lastSyncAt = null;
    }
    store.save();
    return current().mailAccounts;
  });

  handle('mail:remove', (payload) => {
    const state = store.get();
    const id = validId(payload.id, 'Hesap kimliği');
    state.mailAccounts = state.mailAccounts.filter((account) => account.id !== id);
    delete state.secrets[id];
    store.save();
    return current().mailAccounts;
  });

  handle('mail:list', async (payload) => {
    const state = store.get();
    const mailbox = ['inbox', 'all', 'starred', 'sent'].includes(payload.mailbox)
      ? payload.mailbox
      : 'inbox';
    const filter = ['all', 'unread', 'starred', 'attachments'].includes(payload.filter)
      ? payload.filter
      : 'all';
    const query = typeof payload.query === 'string' ? payload.query.trim().slice(0, 120) : '';
    const limit = Math.min(Math.max(Number(payload.limit) || 30, 1), 50);
    let accounts = state.mailAccounts;
    if (payload.accountId) {
      const id = validId(payload.accountId, 'Hesap kimliği');
      accounts = accounts.filter((account) => account.id === id);
      if (!accounts.length) throw new Error('Gmail hesabı bulunamadı.');
    }
    if (!accounts.length) {
      return {
        messages: [],
        accounts: current().mailAccounts,
        errors: [],
        unreadCounts: {},
      };
    }

    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        const record = state.secrets[account.id];
        if (!record || !record.enc) {
          const error = new Error('Bu hesap için uygulama şifresi bulunamadı. Hesabı yeniden düzenle.');
          account.lastError = error.message;
          throw error;
        }
        let password;
        try {
          password = secrets.decrypt(record.enc);
        } catch {
          const error = new Error('Şifreli uygulama şifresi açılamadı. Hesabı yeniden düzenle.');
          account.lastError = error.message;
          throw error;
        }
        try {
          const data = await mail.listAccount(account, password, {
            mailbox,
            filter,
            query,
            limit,
          });
          account.lastSyncAt = Date.now();
          account.lastError = null;
          return { accountId: account.id, ...data };
        } catch (err) {
          account.lastError = err.message;
          throw err;
        }
      }),
    );

    const messages = [];
    const errors = [];
    const unreadCounts = {};
    results.forEach((result, index) => {
      const account = accounts[index];
      if (result.status === 'fulfilled') {
        messages.push(...result.value.messages);
        unreadCounts[account.id] = result.value.unreadCount;
      } else {
        errors.push({
          accountId: account.id,
          email: account.email,
          message: (result.reason && result.reason.message) || 'Gmail bağlantısı başarısız.',
        });
      }
    });
    messages.sort((a, b) => {
      const aTime = a.date ? Date.parse(a.date) : 0;
      const bTime = b.date ? Date.parse(b.date) : 0;
      return bTime - aTime;
    });
    store.save();
    return {
      messages: messages.slice(0, 150),
      accounts: current().mailAccounts,
      errors,
      unreadCounts,
    };
  });

  handle('mail:read', async (payload) => {
    const state = store.get();
    const id = validId(payload.accountId, 'Hesap kimliği');
    const account = state.mailAccounts.find((item) => item.id === id);
    if (!account) throw new Error('Gmail hesabı bulunamadı.');
    const record = state.secrets[account.id];
    if (!record || !record.enc) {
      throw new Error('Bu hesap için uygulama şifresi bulunamadı. Hesabı yeniden düzenle.');
    }
    const password = secrets.decrypt(record.enc);
    const uid = Number(payload.uid);
    if (!Number.isInteger(uid) || uid <= 0) throw new Error('Geçersiz mail kimliği.');
    const mailbox = text(payload.mailbox, 512, 'Klasör');
    return mail.readAccount(account, password, { uid, mailbox });
  });

  handle('mail:star', async (payload) => {
    const state = store.get();
    const id = validId(payload.accountId, 'Hesap kimliği');
    const account = state.mailAccounts.find((item) => item.id === id);
    if (!account) throw new Error('Gmail hesabı bulunamadı.');
    const record = state.secrets[account.id];
    if (!record || !record.enc) {
      throw new Error('Bu hesap için uygulama şifresi bulunamadı. Hesabı yeniden düzenle.');
    }
    const password = secrets.decrypt(record.enc);
    const uid = Number(payload.uid);
    if (!Number.isInteger(uid) || uid <= 0) throw new Error('Geçersiz mail kimliği.');
    const mailbox = text(payload.mailbox, 512, 'Klasör');
    return mail.starAccount(account, password, {
      uid,
      mailbox,
      starred: Boolean(payload.starred),
    });
  });

  handle('youtube:add-key', async (payload) => {
    if (!(await secrets.isAvailable())) {
      throw new Error('Windows güvenli depolama kullanılamıyor. YouTube API anahtarı kaydedilemez.');
    }
    const state = store.get();
    if (state.youtubeKeys.length >= 20) {
      throw new Error('En fazla 20 YouTube API anahtarı eklenebilir.');
    }
    const key = youtube.cleanKey(payload.key);
    const label =
      optionalText(payload.label, 60, 'Anahtar adı') ||
      `YouTube anahtarı ${state.youtubeKeys.length + 1}`;

    let duplicate = false;
    for (const item of state.youtubeKeys) {
      const record = state.secrets[youtubeKeySecretId(item.id)];
      if (!record || !record.enc) continue;
      try {
        if (secrets.decrypt(record.enc) === key) duplicate = true;
      } catch {
        /* bozuk kayıt yeni anahtarı engellemesin */
      }
    }
    if (duplicate) throw new Error('Bu YouTube API anahtarı zaten kayıtlı.');

    const result = await youtube.testKey(key);
    if (!result.ok) throw new Error(result.message);

    const id = crypto.randomUUID();
    state.secrets[youtubeKeySecretId(id)] = {
      enc: secrets.encrypt(key),
      hint: secrets.makeHint(key),
    };
    state.youtubeKeys.push({
      id,
      label,
      isDefault: state.youtubeKeys.length === 0,
      createdAt: Date.now(),
      lastTestedAt: Date.now(),
      lastError: null,
    });
    store.save();
    youtubeMonitor.start();
    return current();
  });

  handle('youtube:update-key', (payload) => {
    const key = findYoutubeKey(validId(payload.id, 'YouTube anahtarı'));
    key.label = text(payload.label, 60, 'Anahtar adı');
    store.save();
    return current();
  });

  handle('youtube:remove-key', (payload) => {
    const keyId = validId(payload.id, 'YouTube anahtarı');
    const state = store.get();
    findYoutubeKey(keyId);
    delete state.secrets[youtubeKeySecretId(keyId)];
    state.youtubeKeys = state.youtubeKeys.filter((item) => item.id !== keyId);
    const fallback = state.youtubeKeys.find((item) => item.isDefault) || state.youtubeKeys[0] || null;
    if (fallback) fallback.isDefault = true;
    for (const channel of state.youtubeChannels) {
      if (channel.keyId === keyId) channel.keyId = fallback ? fallback.id : null;
    }
    store.save();
    if (state.youtubeKeys.length) youtubeMonitor.start();
    else youtubeMonitor.stop();
    return current();
  });

  handle('youtube:set-default-key', (payload) => {
    const keyId = validId(payload.id, 'YouTube anahtarı');
    findYoutubeKey(keyId);
    for (const key of store.get().youtubeKeys) key.isDefault = key.id === keyId;
    for (const channel of store.get().youtubeChannels) {
      if (!channel.keyId) channel.keyId = keyId;
    }
    store.save();
    return current();
  });

  handle('youtube:test-key', async (payload) => {
    let raw = null;
    let entry = null;
    if (payload && payload.id) {
      entry = findYoutubeKey(validId(payload.id, 'YouTube anahtarı'));
      const record = store.get().secrets[youtubeKeySecretId(entry.id)];
      if (!record || !record.enc) throw new Error('Bu anahtarın kaydı bulunamadı.');
      raw = secrets.decrypt(record.enc);
    } else if (payload && payload.key) {
      raw = youtube.cleanKey(payload.key);
    } else {
      const stored = youtubeMonitor.storedKey();
      if (!stored) throw new Error('Önce bir YouTube API anahtarı kaydet.');
      raw = stored.value;
      entry = findYoutubeKey(stored.id);
    }
    const result = await youtube.testKey(raw);
    if (entry) {
      entry.lastTestedAt = Date.now();
      entry.lastError = result.ok ? null : result.message;
      store.save();
    }
    return result;
  });

  handle('youtube:add-channel', async (payload) => {
    const companyId = validId(payload.companyId, 'Şirket');
    findCompany(companyId);
    const input = text(payload.url, 400, 'YouTube kanal adresi');
    const keyId = payload.keyId ? validId(payload.keyId, 'YouTube anahtarı') : undefined;
    await youtubeMonitor.addChannel(companyId, input, keyId);
    return current();
  });

  handle('youtube:set-channel-key', (payload) => {
    const channelId = validId(payload.id, 'YouTube kanalı');
    const keyId = validId(payload.keyId, 'YouTube anahtarı');
    const channel = store.get().youtubeChannels.find((item) => item.id === channelId);
    if (!channel) throw new Error('YouTube kanalı bulunamadı.');
    findYoutubeKey(keyId);
    channel.keyId = keyId;
    channel.lastError = null;
    store.save();
    youtubeMonitor.start();
    return current();
  });

  handle('youtube:remove-channel', (payload) => {
    const id = validId(payload.id, 'YouTube kanalı');
    const state = store.get();
    if (!state.youtubeChannels.some((channel) => channel.id === id)) {
      throw new Error('YouTube kanalı bulunamadı.');
    }
    youtubeMonitor.removeChannel(id);
    return current();
  });

  handle('youtube:refresh', async () => {
    await youtubeMonitor.refresh();
    return current();
  });

  handle('monitor:refresh', async () => {
    await monitor.refresh();
    return current();
  });

  /* --- hesaplar --- */
  handle('session:get', async () => ({
    account: activeAccount,
    accounts: accounts.list(),
    locked: !store,
    meta: {
      appVersion: app.getVersion(),
      secureStorage: await secrets.isAvailable(),
      dataPath: store ? store.file : null,
      platform: process.platform,
    },
  }));

  handle('account:register', async (payload) => {
    const remember = payload.remember !== false;
    const account = accounts.register({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      remember,
    });
    startSession(account);
    return { account, accounts: accounts.list() };
  });

  handle('account:login', async (payload) => {
    const remember = payload.remember !== false;
    const result = accounts.login({
      email: payload.email,
      password: payload.password,
      remember,
    });
    if (result && result.requires2fa) return result;
    startSession(result);
    return { account: result, accounts: accounts.list() };
  });

  handle('account:2fa-verify', async (payload) => {
    const account = accounts.verifyTwoFactor({
      challengeId: payload.challengeId,
      code: payload.code,
    });
    startSession(account);
    return { account, accounts: accounts.list() };
  });

  handle('account:2fa-setup', async () => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    return accounts.beginTwoFactor(activeAccount.id);
  });

  handle('account:2fa-enable', async (payload) => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    const result = accounts.enableTwoFactor(activeAccount.id, { code: payload.code });
    activeAccount = result.account;
    return { ...result, accounts: accounts.list() };
  });

  handle('account:2fa-disable', async (payload) => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    const account = accounts.disableTwoFactor(activeAccount.id, {
      password: payload.password,
      code: payload.code,
    });
    activeAccount = account;
    return { account, accounts: accounts.list() };
  });

  handle('account:2fa-backup', async (payload) => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    const result = accounts.regenerateBackupCodes(activeAccount.id, {
      password: payload.password,
      code: payload.code,
    });
    activeAccount = result.account;
    return { ...result, accounts: accounts.list() };
  });

  handle('account:logout', async () => {
    accounts.lock();
    endSession();
    return { locked: true, accounts: accounts.list() };
  });

  handle('account:update', async (payload) => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    const account = accounts.updateProfile(activeAccount.id, payload);
    activeAccount = account;
    return { account, accounts: accounts.list() };
  });

  handle('account:password', async (payload) => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    const account = accounts.changePassword(activeAccount.id, {
      currentPassword: payload.currentPassword,
      nextPassword: payload.nextPassword,
    });
    activeAccount = account;
    return { account, accounts: accounts.list() };
  });

  handle('account:security', async (payload) => {
    if (!activeAccount) throw new Error('Oturum açık değil.');
    const account = accounts.updateSecurity(activeAccount.id, payload);
    activeAccount = account;
    return { account, accounts: accounts.list() };
  });

  /* --- platform bağlantıları --- */
  handle('connections:platforms', async () =>
    platforms.PLATFORM_LIST.map(
      ({
        id,
        label,
        color,
        hint,
        docsUrl,
        scopes,
        steps,
        exampleToken,
        exampleRefresh,
        tokenPrefix,
        note,
      }) => ({
        id,
        label,
        color,
        hint,
        docsUrl,
        scopes,
        steps,
        exampleToken,
        exampleRefresh: exampleRefresh ?? null,
        tokenPrefix: tokenPrefix ?? null,
        note: note ?? null,
      }),
    ),
  );

  handle('connections:add', async (payload) => {
    if (!(await secrets.isAvailable())) {
      throw new Error('Güvenli depolama kullanılamıyor; erişim jetonu kaydedilemedi.');
    }
    const platform = platforms.platformOf(payload.platform);
    const token = text(payload.token, 4000, 'Erişim jetonu');
    if (token.length < 10) throw new Error('Erişim jetonu çok kısa görünüyor.');
    const refreshToken = optionalText(payload.refreshToken, 4000, 'Yenileme jetonu');
    const label = optionalText(payload.label, 80, 'Hesap adı');

    const state = store.get();
    const count = state.connections.filter((item) => item.platform === platform.id).length;
    const id = crypto.randomUUID();

    state.secrets[id] = { enc: secrets.encrypt(token), hint: secrets.makeHint(token) };
    if (refreshToken) {
      state.secrets[`${id}:refresh`] = {
        enc: secrets.encrypt(refreshToken),
        hint: secrets.makeHint(refreshToken),
      };
    }

    const connection = {
      id,
      platform: platform.id,
      label: label || `${platform.label} hesabı ${count + 1}`,
      externalId: null,
      handle: null,
      avatar: null,
      status: 'unverified',
      lastError: null,
      expiresAt: null,
      isPrimary: count === 0,
      meta: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.connections.push(connection);
    store.save();
    await verifyStoredConnection(connection);
    return current();
  });

  handle('connections:verify', async (payload) => {
    const connection = findConnection(payload.id);
    await verifyStoredConnection(connection);
    return current();
  });

  handle('connections:refresh', async (payload) => {
    const connection = findConnection(payload.id);
    const state = store.get();
    const accessSecret = state.secrets[connection.id];
    const refreshSecret = state.secrets[`${connection.id}:refresh`];
    const access = accessSecret ? secrets.decrypt(accessSecret.enc) : null;
    const refreshValue = refreshSecret ? secrets.decrypt(refreshSecret.enc) : null;

    try {
      const tokens = await platforms.refreshToken(connection.platform, refreshValue, access);
      state.secrets[connection.id] = {
        enc: secrets.encrypt(tokens.accessToken),
        hint: secrets.makeHint(tokens.accessToken),
      };
      if (tokens.refreshToken) {
        state.secrets[`${connection.id}:refresh`] = {
          enc: secrets.encrypt(tokens.refreshToken),
          hint: secrets.makeHint(tokens.refreshToken),
        };
      }
      connection.expiresAt = tokens.expiresAt ?? null;
      connection.status = 'active';
      connection.lastError = null;
    } catch (err) {
      connection.status = 'needs_attention';
      connection.lastError = err.message;
    }
    connection.updatedAt = Date.now();
    store.save();
    return current();
  });

  handle('connections:primary', async (payload) => {
    const connection = findConnection(payload.id);
    for (const item of store.get().connections) {
      if (item.platform === connection.platform) item.isPrimary = item.id === connection.id;
    }
    store.save();
    return current();
  });

  handle('connections:remove', async (payload) => {
    const connection = findConnection(payload.id);
    const state = store.get();
    state.connections = state.connections.filter((item) => item.id !== connection.id);
    delete state.secrets[connection.id];
    delete state.secrets[`${connection.id}:refresh`];
    if (connection.isPrimary) {
      const next = state.connections.find((item) => item.platform === connection.platform);
      if (next) next.isPrimary = true;
    }
    store.save();
    return current();
  });

  /* --- müzik --- */
  handle('music:import', async () => {
    const result = await musicLibrary.importTracks({
      win,
      profileDir: profileDirOf(),
      store,
    });
    return { added: result.added.length, skipped: result.skipped, state: current() };
  });

  handle('music:remove', async (payload) => {
    musicLibrary.removeTrack({
      profileDir: profileDirOf(),
      store,
      id: validId(payload.id, 'Parça'),
    });
    return current();
  });

  handle('music:rename', async (payload) => {
    musicLibrary.renameTrack({
      store,
      id: validId(payload.id, 'Parça'),
      title: payload.title,
      artist: payload.artist,
    });
    return current();
  });

  /* --- çeviri --- */
  handle('translate:languages', async () => translate.LANGUAGES);
  handle('translate:run', async (payload) => translate.translate(payload));

  /* --- asistan --- */
  handle('assistant:status', async () => assistant.status());
  handle('assistant:ask', async (payload) => {
    if (!store) throw new Error('Oturum açık değil.');
    const result = await assistant.ask({
      message: payload.message,
      history: Array.isArray(payload.history) ? payload.history : [],
      store,
      updates,
      appVersion: app.getVersion(),
      account: activeAccount,
    });
    return {
      reply: result.reply,
      source: result.source,
      suggestions: result.suggestions || [],
      navigate: result.navigate || null,
      mutated: Boolean(result.mutated),
      state: result.mutated ? current() : undefined,
    };
  });

  /* --- güncellemeler --- */
  handle('updates:notes', async () => ({
    currentVersion: app.getVersion(),
    entries: updates.CHANGELOG,
    lastSeenVersion: store ? store.get().settings.lastSeenVersion : null,
    feedUrl: store
      ? store.get().settings.updateFeedUrl || updates.DEFAULT_FEED_URL
      : updates.DEFAULT_FEED_URL,
    autoUpdate: store ? store.get().settings.autoUpdate : true,
  }));

  handle('updates:check', async () =>
    updates.checkFeed(
      store.get().settings.updateFeedUrl || updates.DEFAULT_FEED_URL,
      app.getVersion(),
    ),
  );

  handle('updates:mark-seen', async (payload) => {
    store.get().settings.lastSeenVersion = String(payload.version || app.getVersion()).slice(0, 32);
    store.save();
    return current();
  });

  handle('updates:settings', async (payload) => {
    const settings = store.get().settings;
    if (typeof payload.autoUpdate === 'boolean') settings.autoUpdate = payload.autoUpdate;
    if (typeof payload.updateFeedUrl === 'string') {
      settings.updateFeedUrl =
        payload.updateFeedUrl.trim().slice(0, 500) || updates.DEFAULT_FEED_URL;
    }
    store.save();
    scheduleUpdateCheck();
    return current();
  });

  handle('updates:download', async () => {
    const feed = store.get().settings.updateFeedUrl || updates.DEFAULT_FEED_URL;
    const check = await updates.checkFeed(feed, app.getVersion());
    if (!check.available || !check.url) throw new Error('İndirilecek yeni sürüm yok.');
    if (!check.sha256) {
      throw new Error('Güncelleme bildiriminde SHA-256 doğrulaması yok; indirme reddedildi.');
    }
    const result = await updates.downloadInstaller({
      downloadDir: path.join(app.getPath('userData'), 'updates'),
      url: check.url,
      version: check.latest,
      sha256: check.sha256,
    });
    pendingUpdate = { ...result, version: check.latest };
    return { file: result.file, size: result.size, version: check.latest };
  });

  handle('updates:install', async () => {
    if (!pendingUpdate) throw new Error('Önce güncelleme paketini indir.');
    const dir = path.resolve(path.join(app.getPath('userData'), 'updates'));
    const file = path.resolve(pendingUpdate.file);
    if (!file.startsWith(`${dir}${path.sep}`)) {
      throw new Error('Geçersiz güncelleme dosyası.');
    }
    if (!fs.existsSync(file)) throw new Error('Güncelleme dosyası bulunamadı.');
    const child = spawn(file, ['/S'], { detached: true, stdio: 'ignore' });
    child.unref();
    setTimeout(() => app.quit(), 800);
    return { started: true, version: pendingUpdate.version };
  });

  handle('app:open-external', async (payload) => {
    const url = validUrl(payload.url);
    await shell.openExternal(url);
    return true;
  });

  handle('app:export', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(win, {
      title: 'EZWIN HUB yedeğini kaydet',
      defaultPath: `ezwin-hub-yedek-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true, path: null };
    const exportState = {
      exportedAt: new Date().toISOString(),
      note: 'API anahtarları güvenlik gereği yedeğe dahil edilmez.',
      data: current(),
    };
    fs.writeFileSync(result.filePath, JSON.stringify(exportState, null, 2), 'utf8');
    return { canceled: false, path: result.filePath };
  });

  handle('app:reveal-data', async () => {
    shell.showItemInFolder(store.file);
    return true;
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
