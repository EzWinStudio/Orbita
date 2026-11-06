'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  clipboard,
  ipcMain,
  nativeImage,
  net,
  safeStorage,
  session,
  shell,
} = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { execFile, spawn } = require('node:child_process');

const APP_NAME = 'Orbita';
const APP_ID = 'com.ezwin.orbita';
const WEB_ORIGIN = 'https://ezwin.local';
const DATA_ROOT = process.env.EZWIN_USER_DATA
  ? path.resolve(process.env.EZWIN_USER_DATA)
  : path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'EZWIN HUB Tray');
const PROFILE_ROOT = path.join(DATA_ROOT, 'Electron');
const WEB_ROOT = path.join(__dirname, '..', 'web-dist');
const ICON_PNG = path.join(__dirname, 'assets', 'icon.png');
const TRAY_ICO = path.join(WEB_ROOT, 'favicon.ico');
const SETTINGS_FILE = path.join(DATA_ROOT, 'electron-shell.json');
const SECRETS_FILE = path.join(DATA_ROOT, 'bot-secrets.json');
const LOG_FILE = path.join(DATA_ROOT, 'electron.log');
const UPDATE_DIR = path.join(DATA_ROOT, 'updates');
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const RUN_VALUE = 'Orbita';
const DISCORD_API = 'https://discord.com/api/v10';
const SITE_TIMEOUT_MS = 12000;

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);
app.setPath('userData', PROFILE_ROOT);
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

let win = null;
let tray = null;
let quitting = false;
let startHidden = process.argv.includes('--background');
let tickTimer = null;
let updateTimer = null;
let siteCheckRunning = false;
let botCheckRunning = false;
let updateCheckRunning = false;
let pendingUpdate = null;
let updateInfo = {
  supported: false,
  currentVersion: '',
  latest: null,
  available: false,
  downloaded: false,
  downloading: false,
  progress: null,
  error: null,
  checkedAt: null,
  notes: [],
};
let trayStatusPrimary = 'Arka plan hazırlanıyor…';
let trayStatusSecondary = 'Henüz site kontrolü yapılmadı';
let trayBackupStatus = 'Son yedek: —';
let autoStartOn = false;

const defaultSettings = {
  notifications: true,
  hideHintShown: false,
  autoStartInitialized: false,
  autoUpdateInstall: true,
  windowBounds: null,
};

function ensureDir(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true });
  } catch {
    /* best effort */
  }
}

function log(message) {
  try {
    ensureDir(DATA_ROOT);
    const info = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : null;
    if (info && info.size > 1024 * 1024) {
      fs.rmSync(`${LOG_FILE}.old`, { force: true });
      fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    }
    fs.appendFileSync(
      LOG_FILE,
      `${new Date().toISOString().slice(0, 19).replace('T', ' ')}  ${message}\n`,
      'utf8',
    );
  } catch {
    /* logging must never break the app */
  }
}

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...defaultSettings };
  }
}

let settings = readSettings();

function saveSettings() {
  try {
    ensureDir(DATA_ROOT);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    log(`settings save failed: ${error.message}`);
  }
}

function migrateWebView2Data() {
  const source = path.join(
    DATA_ROOT,
    'WebView2',
    'EBWebView',
    'Default',
    'Local Storage',
    'leveldb',
  );
  const target = path.join(PROFILE_ROOT, 'Local Storage', 'leveldb');
  try {
    if (!fs.existsSync(source)) return;
    const sourceFiles = fs.readdirSync(source);
    if (!sourceFiles.some((name) => name.endsWith('.ldb') || name.endsWith('.log'))) return;
    if (fs.existsSync(target)) {
      const targetFiles = fs.readdirSync(target);
      if (targetFiles.some((name) => name.endsWith('.ldb'))) return;
    }
    ensureDir(target);
    for (const name of sourceFiles) {
      if (name === 'LOCK') continue;
      fs.copyFileSync(path.join(source, name), path.join(target, name));
    }
    log(`webview2 profile migrated (${sourceFiles.length} files)`);
  } catch (error) {
    log(`webview2 profile migration failed: ${error.message}`);
  }
}

function compareVersions(left, right) {
  const a = String(left || '').replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right || '').replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.webmanifest') return 'application/manifest+json';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  return 'application/octet-stream';
}

function serveLocal(url) {
  let relative;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return new Response('bad request', { status: 400 });
  }
  let file = path.normalize(path.join(WEB_ROOT, relative || 'index.html'));
  if (!file.startsWith(WEB_ROOT + path.sep) && file !== WEB_ROOT) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(fs.readFileSync(file), {
      status: 200,
      headers: {
        'Content-Type': mimeFor(file),
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    log(`local file failed: ${error.message}`);
    return new Response('server error', { status: 500 });
  }
}

async function setupProtocol() {
  await session.defaultSession.protocol.handle('https', (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'ezwin.local') return serveLocal(url);
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });
}

function sendHost(payload) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('orbita:host-message', JSON.stringify(payload));
  } catch (error) {
    log(`host message failed: ${error.message}`);
  }
}

function showWindow() {
  if (!win || win.isDestroyed()) {
    createWindow(false);
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function showNotification(title, body) {
  if (!settings.notifications || !Notification.isSupported()) return;
  try {
    const notification = new Notification({
      title: String(title || '').slice(0, 120),
      body: String(body || '').slice(0, 500),
      icon: ICON_PNG,
    });
    notification.on('click', showWindow);
    notification.show();
  } catch (error) {
    log(`notification failed: ${error.message}`);
  }
}

function setTrayStatus(primary, secondary) {
  if (typeof primary === 'string' && primary.trim()) trayStatusPrimary = primary.trim().slice(0, 100);
  if (typeof secondary === 'string' && secondary.trim()) trayStatusSecondary = secondary.trim().slice(0, 100);
  rebuildTray();
}

function rebuildTray() {
  if (!tray) return;
  const template = [
    {
      label: "Orbita'yı aç",
      click: showWindow,
    },
    { type: 'separator' },
    { label: trayStatusPrimary, enabled: false },
    { label: trayStatusSecondary, enabled: false },
    { label: trayBackupStatus, enabled: false },
    { label: 'Site 10 dk · Görev 09:00 · Yedek 03:00', enabled: false },
    { type: 'separator' },
    {
      label: 'Şimdi kontrol et',
      click: () => runBackgroundTick(true),
    },
    {
      label: 'Bildirimler',
      type: 'checkbox',
      checked: Boolean(settings.notifications),
      click: (item) => {
        settings.notifications = Boolean(item.checked);
        saveSettings();
        rebuildTray();
      },
    },
    {
      label: 'Windows ile başlat',
      type: 'checkbox',
      checked: autoStartOn,
      click: async (item) => {
        await setAutoStart(Boolean(item.checked));
        rebuildTray();
      },
    },
    { type: 'separator' },
  ];
  if (app.isPackaged) {
    template.push({
      label: pendingUpdate ? `Güncelleme v${pendingUpdate.version} hazır` : 'Güncellemeyi denetle',
      click: () => {
        if (pendingUpdate) installUpdate();
        else void checkForUpdates();
      },
    });
  }
  template.push(
    {
      label: 'Yedek klasörünü aç',
      click: () => {
        const root = backupRoot();
        ensureDir(root);
        void shell.openPath(root);
      },
    },
    {
      label: 'Web sürümünü aç',
      click: () => void shell.openExternal('https://orbita.wasmer.app'),
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        if (pendingUpdate && settings.autoUpdateInstall !== false) {
          const result = installUpdate();
          if (result.ok) return;
        }
        quitting = true;
        app.quit();
      },
    },
  );
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(`Orbita · ${trayStatusPrimary}`);
}

function backupRoot() {
  return path.join(app.getPath('documents'), 'EZWIN HUB', 'Yedekler');
}

function createTray() {
  let icon = nativeImage.createFromPath(TRAY_ICO);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(ICON_PNG);
  if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Orbita · Arka planda');
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
  rebuildTray();
}

function createWindow(show) {
  if (win && !win.isDestroyed()) return;
  const bounds = settings.windowBounds && typeof settings.windowBounds === 'object'
    ? settings.windowBounds
    : null;
  win = new BrowserWindow({
    width: bounds && Number.isFinite(bounds.width) ? Math.max(980, bounds.width) : 1440,
    height: bounds && Number.isFinite(bounds.height) ? Math.max(640, bounds.height) : 920,
    x: bounds && Number.isFinite(bounds.x) ? bounds.x : undefined,
    y: bounds && Number.isFinite(bounds.y) ? bounds.y : undefined,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: 'Orbita',
    backgroundColor: '#050807',
    icon: ICON_PNG,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-shell.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  if (bounds && bounds.maximized) win.maximize();

  win.once('ready-to-show', () => {
    if (show) win.show();
  });

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (!settings.hideHintShown) {
      settings.hideHintShown = true;
      saveSettings();
      showNotification('Orbita arka planda', 'Uygulama arka planda çalışmaya devam ediyor. Açmak için simgeye tıkla.');
    }
  });

  let saveTimer = null;
  const saveBounds = () => {
    if (!win || win.isDestroyed()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      settings.windowBounds = { ...win.getBounds(), maximized: win.isMaximized() };
      saveSettings();
    }, 400);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('maximize', saveBounds);
  win.on('unmaximize', saveBounds);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${WEB_ORIGIN}/`)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });
  win.webContents.on('did-finish-load', () => {
    log('page ready');
    sendHost({ kind: 'host-ready' });
  });
  win.on('closed', () => {
    win = null;
  });

  win.loadURL(`${WEB_ORIGIN}/index.html`).catch((error) => {
    log(`load failed: ${error.message}`);
  });
}

function runBackgroundTick(force) {
  if (!win || win.isDestroyed()) return;
  const options = force ? "{force:true,source:'tray'}" : "{force:false,source:'timer'}";
  win.webContents
    .executeJavaScript(`(function(){var f=window.__ezwinTrayTick;if(f){f(${options});}})();`)
    .catch((error) => log(`tick failed: ${error.message}`));
}

function describeNetworkError(error) {
  if (!error) return 'Bağlantı hatası';
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'Zaman aşımı (12 sn)';
  const cause = error.cause || {};
  const code = String(cause.code || '');
  if (code.includes('CERT') || code.includes('TLS') || code.includes('SSL')) return 'SSL sertifika hatası';
  const message = String(cause.message || error.message || 'Bağlantı hatası')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  return `Bağlantı hatası: ${message.slice(0, 140)}`;
}

async function checkSite(site) {
  const started = Date.now();
  const attempt = async () => {
    const response = await fetch(site.url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Orbita/2.2' },
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
    });
    try {
      await response.body?.cancel();
    } catch {
      /* body is already closed */
    }
    return response;
  };
  let response = null;
  let error = null;
  try {
    response = await attempt();
    if (response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      response = await attempt();
    }
  } catch (failure) {
    error = describeNetworkError(failure);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      response = await attempt();
      error = null;
    } catch (second) {
      error = describeNetworkError(second);
    }
  }
  const latencyMs = Math.max(0, Date.now() - started);
  if (!response) {
    return {
      id: site.id,
      state: 'offline',
      statusCode: null,
      latencyMs,
      error,
      checkedAt: Date.now(),
    };
  }
  const code = response.status;
  const state = code >= 200 && code < 400 ? 'online' : code >= 400 && code < 500 ? 'degraded' : 'offline';
  return {
    id: site.id,
    state,
    statusCode: code,
    latencyMs,
    error: state === 'offline' ? `HTTP ${code}` : null,
    checkedAt: Date.now(),
  };
}

async function startSiteChecks(message) {
  if (siteCheckRunning) return;
  const sites = Array.isArray(message.sites) ? message.sites : [];
  const jobs = [];
  for (const item of sites) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const url = typeof item.url === 'string' ? item.url : '';
    if (!id || !/^https?:\/\//i.test(url)) continue;
    try {
      new URL(url);
    } catch {
      continue;
    }
    jobs.push({ id, url });
    if (jobs.length >= 40) break;
  }
  if (!jobs.length) return;
  siteCheckRunning = true;
  log(`site check started: ${jobs.length}`);
  try {
    const results = await Promise.all(jobs.map((job) => checkSite(job)));
    sendHost({ kind: 'site-results', results, checkedAt: Date.now() });
    log(`site check done: ${results.length}`);
  } catch (error) {
    log(`site check failed: ${error.message}`);
  } finally {
    siteCheckRunning = false;
  }
}

function loadSecrets() {
  try {
    if (!fs.existsSync(SECRETS_FILE)) return {};
    const raw = fs.readFileSync(SECRETS_FILE, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    log(`secrets load failed: ${error.message}`);
    return {};
  }
}

function saveSecrets(store) {
  ensureDir(DATA_ROOT);
  const temp = `${SECRETS_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store), 'utf8');
  fs.copyFileSync(temp, SECRETS_FILE);
  fs.rmSync(temp, { force: true });
}

function decryptSecret(entry) {
  if (!entry || typeof entry.enc !== 'string' || !entry.enc) return null;
  try {
    if (typeof safeStorage.isEncryptionAvailable === 'function' && !safeStorage.isEncryptionAvailable()) {
      return null;
    }
    return safeStorage.decryptString(Buffer.from(entry.enc, 'base64'));
  } catch {
    return null;
  }
}

function encryptSecret(token) {
  if (typeof safeStorage.isEncryptionAvailable === 'function' && !safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows güvenli depolama kullanılamıyor.');
  }
  return safeStorage.encryptString(token).toString('base64');
}

function botHints() {
  const store = loadSecrets();
  const hints = {};
  for (const [id, entry] of Object.entries(store)) {
    if (entry && typeof entry.hint === 'string' && entry.hint) hints[id] = entry.hint;
  }
  return hints;
}

function saveBotSecret(message) {
  const id = typeof message.id === 'string' ? message.id : '';
  const token = typeof message.token === 'string' ? message.token.trim() : '';
  const requestId = typeof message.requestId === 'string' ? message.requestId : '';
  const payload = { kind: 'bot-secret-saved', id, requestId, ok: false };
  try {
    if (!id || id.length > 80) throw new Error('Geçersiz bot kimliği.');
    if (
      token.length < 20 ||
      token.length > 200 ||
      /[\s]/.test(token)
    ) {
      throw new Error('Bot tokenı geçersiz görünüyor.');
    }
    const store = loadSecrets();
    store[id] = {
      enc: encryptSecret(token),
      hint: `••••${token.slice(-4)}`,
    };
    saveSecrets(store);
    payload.ok = true;
    payload.hint = store[id].hint;
    log(`bot secret saved: ${id}`);
  } catch (error) {
    payload.error = String(error.message || 'Token kaydedilemedi.').slice(0, 200);
    log(`bot secret save failed: ${id}`);
  }
  sendHost(payload);
}

function clearBotSecret(message) {
  const id = typeof message.id === 'string' ? message.id : '';
  const requestId = typeof message.requestId === 'string' ? message.requestId : '';
  const payload = { kind: 'bot-secret-saved', id, requestId, ok: false, hint: null };
  try {
    const store = loadSecrets();
    delete store[id];
    saveSecrets(store);
    payload.ok = true;
    log(`bot secret cleared: ${id}`);
  } catch (error) {
    payload.error = String(error.message || 'Token silinemedi.').slice(0, 200);
  }
  sendHost(payload);
}

async function discordGet(apiPath, token) {
  return fetch(`${DISCORD_API}${apiPath}`, {
    headers: {
      Authorization: `Bot ${token}`,
      Accept: 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/EzWinStudio/Orbita, 2.2)',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
  });
}

async function checkBot(token) {
  const started = Date.now();
  const result = {
    assetId: '',
    checkedAt: Date.now(),
    state: 'offline',
    latencyMs: null,
    summary: 'Kontrol edilemedi',
    error: null,
  };
  let meResponse;
  try {
    meResponse = await discordGet('/users/@me', token);
  } catch (error) {
    result.latencyMs = Date.now() - started;
    result.summary = 'Discord API erişilemedi';
    result.error = describeNetworkError(error);
    return result;
  }
  result.latencyMs = Date.now() - started;
  if (meResponse.status === 401) {
    result.summary = 'Token geçersiz';
    result.error = 'Discord tokenı reddedildi (401). Bot tokenını yenile.';
    return result;
  }
  if (meResponse.status === 429) {
    result.state = 'degraded';
    result.summary = 'Discord rate limit';
    result.error = 'Discord API rate limit uyguladı, sonraki kontrolde tekrar denenecek.';
    return result;
  }
  if (!meResponse.ok) {
    result.summary = `Discord API hatası (${meResponse.status})`;
    result.error = `Discord API HTTP ${meResponse.status} döndü.`;
    return result;
  }
  let me;
  try {
    me = await meResponse.json();
  } catch {
    result.state = 'degraded';
    result.summary = 'Bot doğrulandı, yanıt okunamadı';
    result.error = 'Discord yanıtı ayrıştırılamadı.';
    return result;
  }
  const username = typeof me.username === 'string' && me.username ? me.username : 'Bot';
  const botId = typeof me.id === 'string' ? me.id : '';
  let applicationGuilds = 0;
  try {
    const applicationResponse = await discordGet('/oauth2/applications/@me', token);
    if (applicationResponse.ok) {
      const application = await applicationResponse.json();
      if (Number.isFinite(application.approximate_guild_count)) {
        applicationGuilds = application.approximate_guild_count;
      }
    }
  } catch {
    /* application metadata is optional */
  }
  const guilds = [];
  let guildsOk = true;
  try {
    const guildResponse = await discordGet('/users/@me/guilds?limit=200', token);
    if (guildResponse.ok) {
      const parsed = await guildResponse.json();
      if (Array.isArray(parsed)) {
        for (const guild of parsed.slice(0, 200)) {
          const guildId = guild && typeof guild.id === 'string' ? guild.id : '';
          if (!guildId) continue;
          guilds.push({
            id: guildId,
            name: typeof guild.name === 'string' && guild.name ? guild.name : guildId,
          });
        }
      }
    } else {
      guildsOk = false;
    }
  } catch {
    guildsOk = false;
  }
  const guildCount = applicationGuilds > 0 ? applicationGuilds : guilds.length;
  result.state = guildsOk ? 'online' : 'degraded';
  result.summary = guildsOk
    ? `${username} · ${guildCount} sunucu`
    : 'Bot doğrulandı, sunucu listesi alınamadı';
  result.error = guildsOk ? null : 'Bot tokenı geçerli ama sunucu listesi çekilemedi.';
  result.discord = { botId, username, guildCount, guilds };
  return result;
}

async function startBotChecks(message) {
  if (botCheckRunning) return;
  const bots = Array.isArray(message.bots) ? message.bots : [];
  const jobs = [];
  for (const item of bots) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : '';
    if (!id || id.length > 80) continue;
    jobs.push(id);
    if (jobs.length >= 40) break;
  }
  if (!jobs.length) return;
  botCheckRunning = true;
  log(`bot check started: ${jobs.length}`);
  const store = loadSecrets();
  const results = [];
  try {
    for (const id of jobs) {
      const entry = store[id];
      const hint = entry && typeof entry.hint === 'string' ? entry.hint : null;
      const token = decryptSecret(entry);
      if (!token) {
        if (hint) {
          results.push({
            assetId: id,
            checkedAt: Date.now(),
            configured: true,
            hint,
            state: 'offline',
            latencyMs: null,
            summary: 'Anahtar çözülemedi',
            error: 'Kayıtlı bot tokenı çözülemedi. Yeniden bağla.',
          });
        } else {
          results.push({ assetId: id, checkedAt: Date.now(), configured: false, hint: null });
        }
        continue;
      }
      const result = await checkBot(token);
      result.assetId = id;
      result.configured = true;
      result.hint = hint;
      results.push(result);
    }
    sendHost({ kind: 'bot-results', results, checkedAt: Date.now() });
    log(`bot check done: ${results.length}`);
  } catch (error) {
    log(`bot check failed: ${error.message}`);
  } finally {
    botCheckRunning = false;
  }
}

function pruneBackups(root) {
  try {
    const files = fs
      .readdirSync(root)
      .filter((name) => name.startsWith('orbita-yedek-') || name.startsWith('ezwin-hub-yedek-'))
      .map((name) => path.join(root, name))
      .filter((file) => fs.statSync(file).isFile())
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
    for (const file of files.slice(14)) fs.rmSync(file, { force: true });
  } catch (error) {
    log(`backup prune failed: ${error.message}`);
  }
}

async function saveBackup(message) {
  const date = typeof message.date === 'string' ? message.date : '';
  const payload = typeof message.json === 'string' ? message.json : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !payload || payload.length > 8 * 1024 * 1024) {
    sendHost({ kind: 'backup-saved', ok: false, date, error: 'Geçersiz yedek isteği' });
    return;
  }
  try {
    const root = backupRoot();
    ensureDir(root);
    const file = path.join(root, `orbita-yedek-${date}.json`);
    fs.writeFileSync(file, payload, 'utf8');
    pruneBackups(root);
    log(`backup saved: ${date} ${payload.length} bytes`);
    sendHost({ kind: 'backup-saved', ok: true, date, path: file });
  } catch (error) {
    log(`backup failed: ${error.message}`);
    sendHost({ kind: 'backup-saved', ok: false, date, error: String(error.message).slice(0, 300) });
  }
}

function handleWebMessage(event, raw) {
  if (!win || event.sender !== win.webContents) return;
  if (typeof raw !== 'string' || !raw || raw.length > 9 * 1024 * 1024) return;
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message || typeof message !== 'object' || Array.isArray(message)) return;
  const kind = typeof message.kind === 'string' ? message.kind : '';
  if (kind === 'notify') {
    showNotification(message.title, message.body);
    return;
  }
  if (kind === 'status') {
    setTrayStatus(message.primary, message.secondary);
    return;
  }
  if (kind === 'backup-status') {
    if (typeof message.text === 'string' && message.text.trim()) {
      trayBackupStatus = message.text.trim().slice(0, 100);
      rebuildTray();
    }
    return;
  }
  if (kind === 'check-sites') {
    void startSiteChecks(message);
    return;
  }
  if (kind === 'check-bots') {
    void startBotChecks(message);
    return;
  }
  if (kind === 'bot-secret-save') {
    saveBotSecret(message);
    return;
  }
  if (kind === 'bot-secret-clear') {
    clearBotSecret(message);
    return;
  }
  if (kind === 'bot-secret-status') {
    sendHost({ kind: 'bot-secret-status', hints: botHints() });
    return;
  }
  if (kind === 'backup') {
    void saveBackup(message);
  }
}

function runCommand(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true }, (error, stdout) => {
      resolve({ ok: !error, output: String(stdout || '') });
    });
  });
}

async function readAutoStart() {
  if (!app.isPackaged) return false;
  const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
  const result = await runCommand(reg, ['query', RUN_KEY, '/v', RUN_VALUE]);
  return result.ok && result.output.includes(RUN_VALUE);
}

async function setAutoStart(enabled) {
  autoStartOn = enabled;
  if (!app.isPackaged) return;
  const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
  if (enabled) {
    await runCommand(reg, [
      'add',
      RUN_KEY,
      '/v',
      RUN_VALUE,
      '/t',
      'REG_SZ',
      '/d',
      `"${process.execPath}" --background`,
      '/f',
    ]);
  } else {
    await runCommand(reg, ['delete', RUN_KEY, '/v', RUN_VALUE, '/f']);
  }
  settings.autoStartInitialized = true;
  saveSettings();
  log(`autostart: ${enabled ? 'on' : 'off'}`);
}

async function initializeAutoStart() {
  autoStartOn = await readAutoStart();
  if (!settings.autoStartInitialized && app.isPackaged && !autoStartOn) {
    await setAutoStart(true);
    return;
  }
  settings.autoStartInitialized = true;
  saveSettings();
}

function updateView() {
  return { ...updateInfo, currentVersion: app.getVersion(), supported: app.isPackaged };
}

function publishUpdate() {
  updateInfo.currentVersion = app.getVersion();
  updateInfo.supported = app.isPackaged;
  sendHost({ kind: 'update-status', ...updateView() });
}

function releaseNotes(release) {
  return String(release.body || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*/g, '')
        .trim(),
    )
    .filter((line) => line && !/^orbita\s+v?\d/i.test(line))
    .slice(0, 6);
}

async function downloadUpdate(release, version, onProgress) {
  const installerName = `Orbita-Setup-${version}.exe`;
  const installerAsset = (release.assets || []).find((asset) => asset.name === installerName);
  const checksumAsset =
    (release.assets || []).find((asset) => asset.name === `${installerName}.sha256`) ||
    (release.assets || []).find((asset) => asset.name === `Orbita-Setup-${version}.sha256`);
  if (!installerAsset || !checksumAsset) {
    throw new Error(`Güncelleme paketi eksik (${installerName}).`);
  }
  const checksumResponse = await fetch(checksumAsset.browser_download_url, {
    signal: AbortSignal.timeout(15000),
  });
  if (!checksumResponse.ok) throw new Error('Güncelleme doğrulama dosyası alınamadı.');
  const checksumText = await checksumResponse.text();
  const match = checksumText.match(/[a-f0-9]{64}/i);
  if (!match) throw new Error('Güncelleme doğrulama dosyası geçersiz.');
  const expected = match[0].toLowerCase();
  ensureDir(UPDATE_DIR);
  const target = path.join(UPDATE_DIR, installerName);
  if (fs.existsSync(target)) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (digest === expected) {
      onProgress?.(100);
      return { version, file: target, size: fs.statSync(target).size };
    }
    fs.rmSync(target, { force: true });
  }
  const response = await fetch(installerAsset.browser_download_url, {
    signal: AbortSignal.timeout(10 * 60 * 1000),
    redirect: 'follow',
  });
  if (!response.ok || !response.body) {
    throw new Error(`Güncelleme indirilemedi (${response.status}).`);
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256');
  const temp = `${target}.part`;
  fs.rmSync(temp, { force: true });
  const out = fs.createWriteStream(temp);
  out.on('error', () => {});
  let received = 0;
  try {
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      received += buffer.length;
      if (received > 300 * 1024 * 1024) {
        throw new Error('Güncelleme paketi beklenenden büyük.');
      }
      hash.update(buffer);
      if (total > 0) onProgress?.(Math.min(99, Math.round((received / total) * 100)));
      if (!out.write(buffer)) await once(out, 'drain');
    }
    out.end();
    await once(out, 'finish');
    const digest = hash.digest('hex');
    if (digest !== expected) {
      throw new Error('İndirilen güncelleme doğrulanamadı (SHA-256 uyuşmuyor).');
    }
    fs.renameSync(temp, target);
    onProgress?.(100);
    return { version, file: target, size: fs.statSync(target).size };
  } catch (error) {
    out.destroy();
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

async function checkForUpdates(options = {}) {
  if (!app.isPackaged) {
    updateInfo.supported = false;
    updateInfo.currentVersion = app.getVersion();
    if (options.manual) publishUpdate();
    return updateView();
  }
  if (updateCheckRunning) return updateView();
  updateCheckRunning = true;
  updateInfo.supported = true;
  updateInfo.error = null;
  let lastProgressPush = 0;
  try {
    const response = await fetch('https://api.github.com/repos/EzWinStudio/Orbita/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Orbita/2.2' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      throw new Error(`GitHub sürüm bilgisi alınamadı (${response.status}).`);
    }
    const release = await response.json();
    const latest = String(release.tag_name || '').replace(/^v/i, '').trim();
    if (!latest) throw new Error('Sürüm bilgisi bulunamadı.');
    updateInfo.latest = latest;
    updateInfo.notes = releaseNotes(release);
    updateInfo.checkedAt = Date.now();
    if (compareVersions(latest, app.getVersion()) <= 0) {
      pendingUpdate = null;
      updateInfo.available = false;
      updateInfo.downloaded = false;
      updateInfo.downloading = false;
      updateInfo.progress = null;
      rebuildTray();
      publishUpdate();
      return updateView();
    }
    updateInfo.available = true;
    updateInfo.downloaded = false;
    updateInfo.downloading = true;
    updateInfo.progress = 0;
    publishUpdate();
    const downloaded = await downloadUpdate(release, latest, (percent) => {
      updateInfo.progress = percent;
      const now = Date.now();
      if (now - lastProgressPush > 500) {
        lastProgressPush = now;
        publishUpdate();
      }
    });
    pendingUpdate = downloaded;
    updateInfo.downloaded = true;
    updateInfo.downloading = false;
    updateInfo.progress = 100;
    rebuildTray();
    publishUpdate();
    showNotification(
      'Güncelleme hazır',
      `Orbita v${latest} indirildi ve doğrulandı. Uygulamadan veya tepsi menüsünden kurabilirsin.`,
    );
    log(`update ready: ${latest}`);
  } catch (error) {
    updateInfo.downloading = false;
    updateInfo.progress = null;
    updateInfo.error = String(error.message || 'Güncelleme denetlenemedi.').slice(0, 300);
    updateInfo.checkedAt = Date.now();
    publishUpdate();
    log(`update check failed: ${error.message}`);
  } finally {
    updateCheckRunning = false;
    updateInfo.currentVersion = app.getVersion();
  }
  return updateView();
}

function installUpdate() {
  if (!pendingUpdate || !fs.existsSync(pendingUpdate.file)) {
    pendingUpdate = null;
    updateInfo.downloaded = false;
    updateInfo.available = false;
    updateInfo.error = 'İndirilen güncelleme bulunamadı.';
    publishUpdate();
    rebuildTray();
    return { ok: false, error: 'update_missing' };
  }
  try {
    const child = spawn(pendingUpdate.file, ['/S'], { detached: true, stdio: 'ignore' });
    child.unref();
    quitting = true;
    setTimeout(() => app.quit(), 250);
    return { ok: true, version: pendingUpdate.version };
  } catch (error) {
    log(`update install failed: ${error.message}`);
    updateInfo.error = String(error.message || 'Güncelleme başlatılamadı.').slice(0, 300);
    publishUpdate();
    showNotification('Güncelleme başlatılamadı', error.message);
    return { ok: false, error: 'install_failed' };
  }
}

function startTimers() {
  tickTimer = setInterval(() => runBackgroundTick(false), 30000);
  if (app.isPackaged) {
    setTimeout(() => void checkForUpdates(), 10000);
    updateTimer = setInterval(() => void checkForUpdates(), 6 * 60 * 60 * 1000);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(async () => {
    ensureDir(DATA_ROOT);
    ensureDir(PROFILE_ROOT);
    migrateWebView2Data();
    await setupProtocol();
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    ipcMain.on('orbita:web-message', handleWebMessage);
    ipcMain.handle('orbita:copy-text', (event, text) => {
      if (!win || event.sender !== win.webContents) return false;
      if (typeof text !== 'string' || !text || text.length > 100000) return false;
      try {
        clipboard.writeText(text);
        return true;
      } catch (error) {
        log(`clipboard failed: ${error.message}`);
        return false;
      }
    });
    ipcMain.handle('orbita:update-status', (event) => {
      if (!win || event.sender !== win.webContents) return null;
      return updateView();
    });
    ipcMain.handle('orbita:update-check', async (event) => {
      if (!win || event.sender !== win.webContents) return null;
      return checkForUpdates({ manual: true });
    });
    ipcMain.handle('orbita:update-install', (event) => {
      if (!win || event.sender !== win.webContents) return { ok: false };
      return installUpdate();
    });
    updateInfo.currentVersion = app.getVersion();
    updateInfo.supported = app.isPackaged;
    await initializeAutoStart();
    createTray();
    createWindow(!startHidden);
    startTimers();
    log(`shell started (v${app.getVersion()}, hidden=${startHidden})`);
  }).catch((error) => {
    log(`shell startup failed: ${error.stack || error.message}`);
    app.exit(1);
  });

  app.on('before-quit', () => {
    quitting = true;
    if (tickTimer) clearInterval(tickTimer);
    if (updateTimer) clearInterval(updateTimer);
  });

  app.on('window-all-closed', () => {
    if (quitting) app.quit();
  });

  app.on('activate', () => showWindow());
}
