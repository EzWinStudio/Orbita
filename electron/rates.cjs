'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { net } = require('electron');

const API_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR';
const SOURCE = 'Frankfurter · ECB';
const TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

let cacheFile = null;
let cache = null;
let inflight = null;

function init(dir) {
  cacheFile = path.join(dir, 'rates-cache.json');
  cache = readCache();
}

function readCache() {
  if (!cacheFile) return null;
  try {
    return normalizeStored(JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
  } catch {
    return null;
  }
}

function normalizeStored(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tryRate = Number(raw.rates && raw.rates.TRY);
  const eurRate = Number(raw.rates && raw.rates.EUR);
  const fetchedAt = Number(raw.fetchedAt);
  if (!Number.isFinite(tryRate) || tryRate <= 0 || tryRate > 10000) return null;
  if (!Number.isFinite(eurRate) || eurRate <= 0 || eurRate > 10) return null;
  return {
    base: 'USD',
    rates: { TRY: tryRate, EUR: eurRate },
    fetchedAt: Number.isFinite(fetchedAt) && fetchedAt > 0 ? fetchedAt : Date.now(),
    rateDate: typeof raw.rateDate === 'string' ? raw.rateDate : null,
    source: typeof raw.source === 'string' && raw.source.trim() ? raw.source : SOURCE,
  };
}

function persist() {
  if (!cacheFile || !cache) return;
  try {
    const tmp = `${cacheFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    try {
      fs.renameSync(tmp, cacheFile);
    } catch {
      fs.copyFileSync(tmp, cacheFile);
      fs.unlinkSync(tmp);
    }
  } catch (err) {
    console.error('[rates] önbellek yazılamadı:', err.message);
  }
}

async function fetchLive() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await net.fetch(API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const tryRate = Number(data && data.rates && data.rates.TRY);
    const eurRate = Number(data && data.rates && data.rates.EUR);
    if (!Number.isFinite(tryRate) || tryRate <= 1 || tryRate > 10000) {
      throw new Error('TRY kuru geçersiz.');
    }
    if (!Number.isFinite(eurRate) || eurRate <= 0.1 || eurRate > 10) {
      throw new Error('EUR kuru geçersiz.');
    }
    return {
      base: 'USD',
      rates: {
        TRY: Number(tryRate.toFixed(4)),
        EUR: Number(eurRate.toFixed(4)),
      },
      fetchedAt: Date.now(),
      rateDate: typeof data.date === 'string' ? data.date : null,
      source: SOURCE,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function get(force = false) {
  if (!cacheFile) throw new Error('Kur servisi başlatılmadı.');
  if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return { ...cache, stale: false, error: null };
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const next = await fetchLive();
      cache = next;
      persist();
      return { ...next, stale: false, error: null };
    } catch {
      if (cache) {
        return {
          ...cache,
          stale: true,
          error: 'Kur güncellenemedi; son alınan değerler gösteriliyor.',
        };
      }
      throw new Error('Canlı kur alınamadı. İnternet bağlantını kontrol et.');
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

module.exports = { init, get };
