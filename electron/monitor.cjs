'use strict';

const tls = require('node:tls');
const { net } = require('electron');
const secrets = require('./secrets.cjs');

const DISCORD_API = 'https://discord.com/api/v10';
const HISTORY_LIMIT = 60;
const TIMEOUT_MS = 12000;

async function timedFetch(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await net.fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function describeNetworkError(err) {
  const msg = err && err.message ? err.message : 'Bilinmeyen hata';
  if (err && err.name === 'AbortError') return 'Zaman aşımı (12 sn)';
  if (/ENOTFOUND|ERR_NAME_NOT_RESOLVED/i.test(msg)) return 'Alan adı çözümlenemedi';
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(msg)) return 'Bağlantı reddedildi';
  if (/CERT|SSL|TLS/i.test(msg)) return 'SSL sertifika hatası';
  if (/ERR_INTERNET_DISCONNECTED/i.test(msg)) return 'İnternet bağlantısı yok';
  return `Bağlantı hatası: ${msg}`;
}

function sslExpiryFor(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve(null);
      return;
    }
    if (parsed.protocol !== 'https:') {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const socket = tls.connect(
      {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        servername: parsed.hostname,
        timeout: 8000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          const validTo = cert && cert.valid_to ? Date.parse(cert.valid_to) : NaN;
          socket.end();
          done(Number.isFinite(validTo) ? validTo : null);
        } catch {
          socket.destroy();
          done(null);
        }
      },
    );
    socket.on('timeout', () => {
      socket.destroy();
      done(null);
    });
    socket.on('error', () => {
      socket.destroy();
      done(null);
    });
  });
}

function pushHistory(prevStatus, checkedAt, ok, ms) {
  const history = Array.isArray(prevStatus && prevStatus.website && prevStatus.website.history)
    ? [...prevStatus.website.history]
    : [];
  history.push({ t: checkedAt, ok, ms: Number.isFinite(ms) ? Math.round(ms) : null });
  return history.slice(-HISTORY_LIMIT);
}

async function checkWebsite(asset, prevStatus) {
  const checkedAt = Date.now();
  const started = Date.now();
  let response;
  try {
    response = await timedFetch(
      asset.config.url,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'EZWIN-HUB/1.0 (uptime monitor)',
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
        },
      },
      15000,
    );
  } catch (err) {
    const ms = Date.now() - started;
    return {
      assetId: asset.id,
      checkedAt,
      state: 'offline',
      latencyMs: ms,
      summary: describeNetworkError(err),
      error: describeNetworkError(err),
      website: {
        statusCode: null,
        sslExpiresAt: null,
        history: pushHistory(prevStatus, checkedAt, false, ms),
      },
    };
  }

  const latencyMs = Date.now() - started;
  const statusCode = response.status;
  if (response.body) {
    try {
      await response.body.cancel();
    } catch {
      /* ignore */
    }
  }
  const sslExpiresAt = await sslExpiryFor(asset.config.url);
  const sslDays = sslExpiresAt ? Math.ceil((sslExpiresAt - Date.now()) / 86400000) : null;

  let state = 'online';
  let summary = `HTTP ${statusCode} · ${latencyMs} ms`;
  let error = null;

  if (statusCode >= 500) {
    state = 'offline';
    error = `Sunucu hatası (HTTP ${statusCode})`;
  } else if (statusCode >= 400) {
    state = 'degraded';
    error = `Yanıt verdi ama hata kodu döndü (HTTP ${statusCode})`;
  } else if (latencyMs > 3000) {
    state = 'degraded';
    error = 'Yavaş yanıt (3 sn üzeri)';
  } else if (sslDays !== null && sslDays < 7) {
    state = 'degraded';
    error = `SSL sertifikası ${sslDays <= 0 ? 'süresi dolmuş' : sslDays + ' gün içinde doluyor'}`;
  }

  if (sslDays !== null && sslDays >= 0 && sslDays <= 30) {
    summary += ` · SSL ${sslDays} gün`;
  }

  return {
    assetId: asset.id,
    checkedAt,
    state,
    latencyMs,
    summary,
    error,
    website: {
      statusCode,
      sslExpiresAt,
      history: pushHistory(prevStatus, checkedAt, state !== 'offline', latencyMs),
    },
  };
}

function discordHeaders(token) {
  return {
    Authorization: `Bot ${token}`,
    Accept: 'application/json',
    'User-Agent': 'DiscordBot (https://ezwin.hub, 1.0)',
  };
}

async function checkDiscord(asset, token) {
  const checkedAt = Date.now();
  const started = Date.now();
  let response;
  try {
    response = await timedFetch(`${DISCORD_API}/users/@me`, { headers: discordHeaders(token) });
  } catch (err) {
    return {
      assetId: asset.id,
      checkedAt,
      state: 'offline',
      latencyMs: Date.now() - started,
      summary: 'Discord API erişilemedi',
      error: describeNetworkError(err),
    };
  }
  const latencyMs = Date.now() - started;

  if (response.status === 401) {
    return {
      assetId: asset.id,
      checkedAt,
      state: 'offline',
      latencyMs,
      summary: 'Token geçersiz',
      error: 'Discord tokenı reddedildi (401). Bot tokenını yenile.',
    };
  }
  if (response.status === 429) {
    return {
      assetId: asset.id,
      checkedAt,
      state: 'degraded',
      latencyMs,
      summary: 'Discord rate limit',
      error: 'Discord API rate limit uyguladı, sonraki kontrolde tekrar denenecek.',
    };
  }
  if (!response.ok) {
    return {
      assetId: asset.id,
      checkedAt,
      state: 'offline',
      latencyMs,
      summary: `Discord API hatası (${response.status})`,
      error: `Discord API HTTP ${response.status} döndü.`,
    };
  }

  let me;
  try {
    me = await response.json();
  } catch {
    return {
      assetId: asset.id,
      checkedAt,
      state: 'degraded',
      latencyMs,
      summary: 'Bot doğrulandı, yanıt okunamadı',
      error: 'Discord yanıtı ayrıştırılamadı.',
    };
  }

  let guilds = [];
  let guildsOk = true;
  let application = null;
  try {
    const appRes = await timedFetch(`${DISCORD_API}/oauth2/applications/@me`, {
      headers: discordHeaders(token),
    });
    if (appRes.ok) application = await appRes.json();
  } catch {
    application = null;
  }

  try {
    const guildRes = await timedFetch(`${DISCORD_API}/users/@me/guilds?limit=200`, {
      headers: discordHeaders(token),
    });
    if (guildRes.ok) {
      const json = await guildRes.json();
      guilds = Array.isArray(json)
        ? json.map((g) => ({ id: g.id, name: g.name }))
        : [];
    } else {
      guildsOk = false;
    }
  } catch {
    guildsOk = false;
  }

  const guildCount =
    application && Number.isFinite(application.approximate_guild_count)
      ? application.approximate_guild_count
      : guilds.length;

  return {
    assetId: asset.id,
    checkedAt,
    state: guildsOk ? 'online' : 'degraded',
    latencyMs,
    summary: guildsOk
      ? `${me.username || 'Bot'} · ${guildCount} sunucu`
      : `${me.username || 'Bot'} doğrulandı · sunucu listesi alınamadı`,
    error: guildsOk ? null : 'Bot tokenı geçerli ama sunucu listesi çekilemedi.',
    discord: {
      botId: me.id,
      username: me.username,
      guildCount,
      guilds,
    },
  };
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function pterodactylHeaders(key) {
  return {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'User-Agent': 'EZWIN-HUB/1.0',
  };
}

async function pterodactylJson(url, key) {
  const response = await timedFetch(url, { headers: pterodactylHeaders(key) });
  if (response.status === 401) {
    const error = new Error('API anahtarı reddedildi (401). Client API anahtarını kontrol et.');
    error.code = 'auth';
    throw error;
  }
  if (response.status === 403) {
    const error = new Error('API anahtarının bu panele erişim yetkisi yok (403).');
    error.code = 'auth';
    throw error;
  }
  if (response.status === 404) {
    const error = new Error('Panel API adresi bulunamadı (404). Panel URL’sini kontrol et.');
    error.code = 'notfound';
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Panel API hatası (HTTP ${response.status}).`);
    error.code = 'http';
    throw error;
  }
  return response.json();
}

async function checkPterodactyl(asset, token) {
  const checkedAt = Date.now();
  const started = Date.now();
  const base = normalizeBaseUrl(asset.config.baseUrl);

  if (String(token).startsWith('ptla_')) {
    return {
      assetId: asset.id,
      checkedAt,
      state: 'offline',
      latencyMs: 0,
      summary: 'Yanlış anahtar türü',
      error:
        'Application API anahtarı (ptla_) desteklenmiyor. Pterodactyl panelinde Account → API Credentials bölümünden Client anahtarı (pacc_) oluştur.',
    };
  }

  let list;
  try {
    list = await pterodactylJson(`${base}/api/client/servers`, token);
  } catch (err) {
    const summary =
      err.code === 'auth'
        ? 'Panel anahtarı geçersiz'
        : err.code === 'notfound'
          ? 'Panel adresi bulunamadı'
          : err.code === 'http'
            ? 'Panel API hatası'
            : 'Panele ulaşılamadı';
    return {
      assetId: asset.id,
      checkedAt,
      state: 'offline',
      latencyMs: Date.now() - started,
      summary,
      error: err.code ? err.message : describeNetworkError(err),
    };
  }

  const rawServers = Array.isArray(list && list.data) ? list.data : [];
  const servers = rawServers.slice(0, 15);

  const accountPromise = pterodactylJson(`${base}/api/client/account`, token).catch(() => null);
  const resources = await Promise.allSettled(
    servers.map((srv) =>
      pterodactylJson(`${base}/api/client/servers/${srv.attributes.identifier}/resources`, token),
    ),
  );
  const account = await accountPromise;

  let failed = 0;
  const panelServers = servers.map((srv, index) => {
    const attr = srv.attributes || {};
    const limits = attr.limits || {};
    const res = resources[index];
    if (res.status !== 'fulfilled') {
      failed += 1;
      return {
        id: attr.identifier,
        name: attr.name || attr.identifier,
        state: 'unknown',
        cpuPercent: null,
        memoryMb: null,
        memoryLimitMb: limits.memory || null,
        diskMb: null,
        diskLimitMb: limits.disk || null,
        uptimeMs: null,
      };
    }
    const data = res.value && res.value.attributes ? res.value.attributes : {};
    const usage = data.resources || {};
    return {
      id: attr.identifier,
      name: attr.name || attr.identifier,
      state: data.current_state || 'unknown',
      cpuPercent: Number.isFinite(usage.cpu_absolute) ? Math.round(usage.cpu_absolute * 10) / 10 : null,
      memoryMb: Number.isFinite(usage.memory_bytes) ? Math.round(usage.memory_bytes / 1048576) : null,
      memoryLimitMb: limits.memory || null,
      diskMb: Number.isFinite(usage.disk_bytes) ? Math.round(usage.disk_bytes / 1048576) : null,
      diskLimitMb: limits.disk || null,
      uptimeMs: Number.isFinite(usage.uptime) ? usage.uptime : null,
    };
  });

  const running = panelServers.filter((s) => s.state === 'running').length;
  const accountName =
    account && account.attributes ? account.attributes.username || account.attributes.email || null : null;
  let state = 'online';
  if (panelServers.length === 0) state = 'offline';
  else if (running === 0) state = 'offline';
  else if (failed > 0 || running < panelServers.length) state = 'degraded';

  const parts = [];
  if (panelServers.length === 0) parts.push('Sunucu bulunamadı');
  else parts.push(`${running}/${panelServers.length} sunucu çalışıyor`);
  if (rawServers.length > servers.length) parts.push(`${rawServers.length} sunucudan ilk ${servers.length} izleniyor`);
  if (failed > 0) parts.push(`${failed} sunucu verisi alınamadı`);

  return {
    assetId: asset.id,
    checkedAt,
    state,
    latencyMs: Date.now() - started,
    summary: parts.join(' · '),
    error: failed > 0 ? 'Bazı sunucuların canlı kaynak verisi alınamadı.' : null,
    pterodactyl: {
      account: accountName,
      total: rawServers.length,
      servers: panelServers,
    },
  };
}

async function evaluateAsset(asset, token, prevStatus) {
  if (asset.type === 'website') return checkWebsite(asset, prevStatus);
  if (asset.type === 'discord') return checkDiscord(asset, token);
  if (asset.type === 'pterodactyl') return checkPterodactyl(asset, token);
  return {
    assetId: asset.id,
    checkedAt: Date.now(),
    state: 'offline',
    latencyMs: null,
    summary: 'Bilinmeyen servis türü',
    error: 'Bu servis türü desteklenmiyor.',
  };
}

class Monitor {
  constructor({ store, onStatuses, onTransition, intervalSec }) {
    this.store = store;
    this.onStatuses = onStatuses;
    this.onTransition = onTransition;
    this.intervalSec = intervalSec || 60;
    this.timer = null;
    this.initialTimer = null;
    this.running = false;
  }

  start() {
    this.stop();
    this.initialTimer = setTimeout(() => {
      this.runAll('auto');
    }, 1400);
    this.timer = setInterval(() => this.runAll('auto'), Math.max(30, this.intervalSec) * 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.initialTimer) clearTimeout(this.initialTimer);
    this.timer = null;
    this.initialTimer = null;
  }

  restart(intervalSec) {
    this.intervalSec = intervalSec || this.intervalSec;
    this.start();
  }

  broadcast() {
    if (typeof this.onStatuses === 'function') {
      this.onStatuses(this.store.get().statuses);
    }
  }

  async runAll() {
    if (this.running) return;
    this.running = true;
    try {
      const state = this.store.get();
      const assets = [...state.assets];
      for (const asset of assets) {
        await this.checkOne(asset);
      }
      this.store.save();
    } finally {
      this.running = false;
      this.broadcast();
    }
  }

  async checkOne(asset) {
    const state = this.store.get();
    const secretRecord = state.secrets[asset.id];
    let token = null;
    if (asset.type !== 'website') {
      if (!secretRecord || !secretRecord.enc) return;
      try {
        token = secrets.decrypt(secretRecord.enc);
      } catch (err) {
        state.statuses[asset.id] = {
          assetId: asset.id,
          checkedAt: Date.now(),
          state: 'offline',
          latencyMs: null,
          summary: 'Anahtar çözülemedi',
          error: `Şifreli anahtar açılamadı: ${err.message}`,
        };
        this.broadcast();
        return;
      }
    }

    const prev = state.statuses[asset.id];
    const result = await evaluateAsset(asset, token, prev);
    if (!this.store.get().assets.some((a) => a.id === asset.id)) return;
    this.store.get().statuses[asset.id] = result;
    this.store.save();
    if (prev && prev.state !== 'offline' && result.state === 'offline') {
      try {
        if (typeof this.onTransition === 'function') {
          this.onTransition(asset, prev, result);
        }
      } catch (err) {
        console.error('[monitor:notification]', err.message);
      }
    }
    this.broadcast();
  }

  async refresh() {
    await this.runAll();
  }

  async test({ type, config, token, assetId }) {
    const fakeAsset = {
      id: assetId || 'test',
      type,
      config: config || {},
      name: 'test',
    };
    let effectiveToken = token || null;
    if (!effectiveToken && assetId) {
      const record = this.store.get().secrets[assetId];
      if (record && record.enc) {
        try {
          effectiveToken = secrets.decrypt(record.enc);
        } catch {
          return { ok: false, message: 'Kayıtlı anahtar çözülemedi.' };
        }
      }
    }
    if (type !== 'website' && !effectiveToken) {
      return { ok: false, message: 'Önce bir API anahtarı gir.' };
    }
    const prev = assetId ? this.store.get().statuses[assetId] : null;
    const result = await evaluateAsset(fakeAsset, effectiveToken, prev);
    return {
      ok: result.state !== 'offline',
      state: result.state,
      message: result.error ? `${result.summary} — ${result.error}` : result.summary,
      result,
    };
  }
}

module.exports = { Monitor };
