'use strict';

const { net } = require('electron');
const secrets = require('./secrets.cjs');
const { youtubeKeySecretId } = require('./store.cjs');

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const POLL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const EVENTS_LIMIT = 500;
const RECENT_COMMENTS_LIMIT = 12;
const SEEN_COMMENTS_LIMIT = 200;
const AVATAR_MAX_BYTES = 320 * 1024;
const COMMENTS_CHANNEL_INTERVAL_MS = 5 * 60 * 1000;
const COMMENTS_VIDEOS_INTERVAL_MS = 15 * 60 * 1000;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

class YoutubeApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'YoutubeApiError';
    this.code = code;
    this.status = status || 0;
  }
}

function reasonOf(data) {
  try {
    const errors = data && data.error && data.error.errors;
    if (Array.isArray(errors) && errors[0] && typeof errors[0].reason === 'string') {
      if (errors[0].reason !== 'badRequest') return errors[0].reason;
    }
    const details = data && data.error && data.error.details;
    if (Array.isArray(details)) {
      const known = details.find(
        (detail) =>
          detail &&
          typeof detail.reason === 'string' &&
          [
            'API_KEY_INVALID',
            'SERVICE_DISABLED',
            'API_KEY_SERVICE_BLOCKED',
            'API_KEY_HTTP_REFERRER_BLOCKED',
            'API_KEY_IP_ADDRESS_BLOCKED',
          ].includes(detail.reason),
      );
      if (known) return known.reason;
    }
    if (Array.isArray(errors) && errors[0] && typeof errors[0].reason === 'string') {
      return errors[0].reason;
    }
    if (data && data.error && typeof data.error.status === 'string') return data.error.status;
  } catch {
    /* ignore */
  }
  return '';
}

function friendlyApiMessage(reason, status) {
  if (
    status === 401 ||
    [
      'keyInvalid',
      'keyExpired',
      'ipRefererBlocked',
      'accessNotConfigured',
      'API_KEY_INVALID',
      'API_KEY_SERVICE_BLOCKED',
      'API_KEY_HTTP_REFERRER_BLOCKED',
      'API_KEY_IP_ADDRESS_BLOCKED',
    ].includes(reason)
  ) {
    return 'YouTube API anahtarı reddedildi. Anahtarın YouTube Data API v3 için etkin olduğunu kontrol et.';
  }
  if (reason === 'SERVICE_DISABLED') {
    return 'YouTube Data API v3 bu anahtar için etkin değil. Google Cloud’da API’yi etkinleştir.';
  }
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return 'YouTube günlük API kotası doldu. Kota sıfırlanınca kontrol otomatik devam eder.';
  }
  if (reason === 'rateLimitExceeded') {
    return 'YouTube istek sınırı aşıldı. Birkaç dakika sonra tekrar denenecek.';
  }
  if (reason === 'commentsDisabled') {
    return 'Bu kanalda yorumlar kapalı.';
  }
  if (reason === 'channelNotFound' || reason === 'videoNotFound' || reason === 'playlistNotFound') {
    return 'YouTube kanalı veya videosu bulunamadı.';
  }
  return 'YouTube API isteği başarısız oldu.';
}

function isFatal(err) {
  if (!(err instanceof YoutubeApiError)) return true;
  return [
    'timeout',
    'network',
    'keyInvalid',
    'keyExpired',
    'ipRefererBlocked',
    'accessNotConfigured',
    'API_KEY_INVALID',
    'API_KEY_SERVICE_BLOCKED',
    'API_KEY_HTTP_REFERRER_BLOCKED',
    'API_KEY_IP_ADDRESS_BLOCKED',
    'SERVICE_DISABLED',
    'quotaExceeded',
    'dailyLimitExceeded',
    'rateLimitExceeded',
    'API_KEY_INVALID',
  ].includes(err.code);
}

function errorMessage(err) {
  if (err instanceof YoutubeApiError) return err.message;
  if (err && err.name === 'AbortError') return 'YouTube yanıtı zaman aşımına uğradı.';
  return 'YouTube verisi alınamadı.';
}

function cleanKey(value) {
  if (typeof value !== 'string') throw new Error('YouTube API anahtarı gerekli.');
  const key = value.trim();
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(key)) {
    throw new Error('YouTube API anahtarı geçersiz görünüyor. Anahtarı Google Cloud’dan yeniden kopyala.');
  }
  return key;
}

async function apiGet(path, params, key) {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') search.set(name, String(value));
  }
  search.set('key', key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await net.fetch(`${API_BASE}/${path}?${search.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'EZWIN-HUB/1.0' },
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new YoutubeApiError('timeout', 'YouTube yanıtı zaman aşımına uğradı.');
    }
    throw new YoutubeApiError('network', 'YouTube’a ulaşılamadı. İnternet bağlantısını kontrol et.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const reason = reasonOf(data) || `http_${response.status}`;
    throw new YoutubeApiError(reason, friendlyApiMessage(reason, response.status), response.status);
  }
  return data || {};
}

async function testKey(rawKey) {
  try {
    const key = cleanKey(rawKey);
    await apiGet('i18nLanguages', { part: 'snippet', hl: 'en' }, key);
    return { ok: true, message: 'YouTube API anahtarı doğrulandı.' };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

function normalizeHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '');
  if (!/^[\p{L}\p{N}._-]{2,50}$/u.test(handle)) {
    throw new Error('YouTube kanal adı geçersiz. @kanaladı veya kanal bağlantısı gir.');
  }
  return handle;
}

function safelyDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseChannelInput(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('YouTube kanal bağlantısı veya @kanaladı gir.');
  }
  const value = raw.trim();
  if (value.length > 400) throw new Error('YouTube kanal adresi çok uzun.');
  if (CHANNEL_ID_RE.test(value)) return { channelId: value };
  if (value.startsWith('@')) return { handle: normalizeHandle(value) };

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error('YouTube kanal bağlantısı geçersiz.');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (!['youtube.com', 'music.youtube.com'].includes(host)) {
    throw new Error('Yalnızca youtube.com kanal bağlantıları kullanılabilir.');
  }
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map(safelyDecode);
  if (segments[0] === 'channel' && segments[1]) {
    if (!CHANNEL_ID_RE.test(segments[1])) throw new Error('YouTube kanal kimliği geçersiz.');
    return { channelId: segments[1] };
  }
  if (segments[0] === 'user' && segments[1]) return { username: segments[1] };
  if (segments[0] === 'c' && segments[1]) return { customName: segments[1] };
  if (segments[0] && segments[0].startsWith('@')) return { handle: normalizeHandle(segments[0]) };
  if (segments[0]) return { handle: normalizeHandle(segments[0]) };
  throw new Error('YouTube kanal bağlantısı geçersiz.');
}

async function scrapeChannelId(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await net.fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) return null;
  let html = '';
  try {
    html = await response.text();
  } catch {
    return null;
  }
  const match =
    html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/) ||
    html.match(/channel_id=(UC[A-Za-z0-9_-]{22})/);
  return match ? match[1] : null;
}

function channelParts() {
  return 'snippet,statistics,contentDetails';
}

async function queryChannels(params, key) {
  try {
    return await apiGet('channels', { part: channelParts(), ...params }, key);
  } catch (err) {
    if (err instanceof YoutubeApiError && /^http_400$/.test(err.code)) return { items: [] };
    throw err;
  }
}

async function getChannelById(channelId, key) {
  const data = await queryChannels({ id: channelId }, key);
  const item = Array.isArray(data.items) ? data.items[0] : null;
  return item || null;
}

async function resolveChannel(reference, key) {
  let item = null;

  if (reference.channelId) {
    item = await getChannelById(reference.channelId, key);
  } else if (reference.handle) {
    const handle = reference.handle.replace(/^@/, '');
    for (const candidate of [handle, `@${handle}`]) {
      const data = await queryChannels({ forHandle: candidate }, key);
      if (Array.isArray(data.items) && data.items[0]) {
        item = data.items[0];
        break;
      }
    }
    if (!item) {
      const channelId = await scrapeChannelId(
        `https://www.youtube.com/@${encodeURIComponent(handle)}`,
      );
      if (channelId) item = await getChannelById(channelId, key);
    }
  } else if (reference.username) {
    const data = await queryChannels({ forUsername: reference.username }, key);
    item = (Array.isArray(data.items) && data.items[0]) || null;
    if (!item) {
      const channelId = await scrapeChannelId(
        `https://www.youtube.com/user/${encodeURIComponent(reference.username)}`,
      );
      if (channelId) item = await getChannelById(channelId, key);
    }
  } else if (reference.customName) {
    const channelId = await scrapeChannelId(
      `https://www.youtube.com/c/${encodeURIComponent(reference.customName)}`,
    );
    if (channelId) item = await getChannelById(channelId, key);
  }

  if (!item || !item.id) {
    throw new YoutubeApiError(
      'channelNotFound',
      'YouTube kanalı bulunamadı. Kanal adresini veya @kanaladını kontrol et.',
    );
  }
  return item;
}

function toInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function snapshotOf(item) {
  const snippet = item.snippet || {};
  const statistics = item.statistics || {};
  const thumbnails = snippet.thumbnails || {};
  const avatarUrl =
    (thumbnails.high && thumbnails.high.url) ||
    (thumbnails.medium && thumbnails.medium.url) ||
    (thumbnails.default && thumbnails.default.url) ||
    null;
  const hiddenSubscribers = Boolean(statistics.hiddenSubscriberCount);
  return {
    title: String(snippet.title || '').trim().slice(0, 200) || 'YouTube',
    handle:
      typeof snippet.customUrl === 'string' && snippet.customUrl.trim()
        ? snippet.customUrl.trim().slice(0, 80)
        : null,
    avatarUrl,
    subscribers: hiddenSubscribers ? null : toInt(statistics.subscriberCount),
    hiddenSubscribers,
    views: toInt(statistics.viewCount),
    videos: toInt(statistics.videoCount),
  };
}

async function fetchAvatar(url) {
  if (
    typeof url !== 'string' ||
    !/^https:\/\/(yt3\.ggpht\.com|yt3\.googleusercontent\.com|i\.ytimg\.com|lh3\.googleusercontent\.com)\//.test(
      url,
    )
  ) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await net.fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > AVATAR_MAX_BYTES) return null;
    return `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function validIso(value) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function mapComment(thread) {
  const snippet = thread && thread.snippet ? thread.snippet : {};
  const top = snippet.topLevelComment && snippet.topLevelComment.snippet ? snippet.topLevelComment.snippet : {};
  const id = (snippet.topLevelComment && snippet.topLevelComment.id) || thread.id;
  if (!id) return null;
  const text = cleanText(top.textDisplay || top.textOriginal || '', 600);
  if (!text) return null;
  return {
    id: String(id).slice(0, 120),
    author: cleanText(top.authorDisplayName || 'YouTube', 80) || 'YouTube',
    text,
    publishedAt: validIso(top.publishedAt),
    likeCount: toInt(top.likeCount),
    videoId: typeof snippet.videoId === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(snippet.videoId)
      ? snippet.videoId
      : null,
    videoTitle: null,
  };
}

async function enrichVideoTitles(comments, key) {
  const ids = [...new Set(comments.map((comment) => comment.videoId).filter(Boolean))].slice(0, 20);
  if (!ids.length) return;
  try {
    const data = await apiGet('videos', { part: 'snippet', id: ids.join(',') }, key);
    const titles = new Map(
      (data.items || []).map((item) => [item.id, String((item.snippet && item.snippet.title) || '').slice(0, 200)]),
    );
    for (const comment of comments) {
      if (comment.videoId && titles.get(comment.videoId)) {
        comment.videoTitle = titles.get(comment.videoId);
      }
    }
  } catch {
    /* titles are optional */
  }
}

function mergeComments(lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const comment of list) {
      if (comment && !byId.has(comment.id)) byId.set(comment.id, comment);
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, RECENT_COMMENTS_LIMIT);
}

async function fetchAllThreadComments(channel, key) {
  const data = await apiGet(
    'commentThreads',
    {
      part: 'snippet',
      allThreadsRelatedToChannelId: channel.channelId,
      order: 'time',
      maxResults: 25,
      textFormat: 'plainText',
    },
    key,
  );
  const comments = (data.items || []).map(mapComment).filter(Boolean);
  await enrichVideoTitles(comments, key);
  return { scope: 'channel', comments: mergeComments([comments]) };
}

async function fetchVideoComments(channel, key, originalError) {
  const uploads = `UU${channel.channelId.slice(2)}`;
  const playlist = await apiGet(
    'playlistItems',
    { part: 'snippet,contentDetails', playlistId: uploads, maxResults: 3 },
    key,
  );
  const items = Array.isArray(playlist.items) ? playlist.items : [];
  if (!items.length) return { scope: 'videos', comments: [] };

  const results = await Promise.allSettled(
    items.map(async (item) => {
      const videoId =
        (item.contentDetails && item.contentDetails.videoId) ||
        (item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId);
      if (!videoId) return [];
      try {
        const data = await apiGet(
          'commentThreads',
          {
            part: 'snippet',
            videoId,
            order: 'time',
            maxResults: 5,
            textFormat: 'plainText',
          },
          key,
        );
        const title = String((item.snippet && item.snippet.title) || '').slice(0, 200) || null;
        return (data.items || [])
          .map(mapComment)
          .filter(Boolean)
          .map((comment) => ({ ...comment, videoTitle: title }));
      } catch (err) {
        if (isFatal(err)) throw err;
        return [];
      }
    }),
  );

  const fatal = results.find(
    (result) => result.status === 'rejected' && isFatal(result.reason),
  );
  if (fatal) throw fatal.reason;
  const lists = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const merged = mergeComments(lists);
  if (!merged.length) {
    const reasons = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    if (reasons.length && reasons.every((err) => err instanceof YoutubeApiError && err.code === 'commentsDisabled')) {
      throw new YoutubeApiError('commentsDisabled', 'Bu kanalda yorumlar kapalı.');
    }
    if (reasons.length && reasons.every((err) => err instanceof YoutubeApiError)) {
      throw new YoutubeApiError('commentsUnavailable', 'Bu kanalın yorumları alınamıyor.');
    }
    if (originalError instanceof YoutubeApiError) throw originalError;
  }
  return { scope: 'videos', comments: merged };
}

async function fetchComments(channel, key) {
  try {
    return await fetchAllThreadComments(channel, key);
  } catch (err) {
    if (isFatal(err) || (err instanceof YoutubeApiError && err.code === 'commentsDisabled')) throw err;
    return fetchVideoComments(channel, key, err);
  }
}

class YoutubeMonitor {
  constructor({ store, onUpdate }) {
    this.store = store;
    this.onUpdate = onUpdate;
    this.timer = null;
    this.initialTimer = null;
    this.running = false;
    this.newEvents = [];
    this.lastCommentsAt = new Map();
  }

  start() {
    this.stop();
    this.initialTimer = setTimeout(() => {
      this.pollAll().catch(() => console.error('[youtube] ilk kontrol başarısız'));
    }, 8000);
    this.timer = setInterval(() => {
      this.pollAll().catch(() => console.error('[youtube] kontrol başarısız'));
    }, POLL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.initialTimer) clearTimeout(this.initialTimer);
    this.timer = null;
    this.initialTimer = null;
  }

  storedKey(keyId) {
    const state = this.store.get();
    const keys = Array.isArray(state.youtubeKeys) ? state.youtubeKeys : [];
    const entry = keyId
      ? keys.find((key) => key.id === keyId)
      : keys.find((key) => key.isDefault) || keys[0];
    if (!entry) return null;
    const record = state.secrets[youtubeKeySecretId(entry.id)];
    if (!record || !record.enc) return null;
    return { id: entry.id, label: entry.label, value: secrets.decrypt(record.enc) };
  }

  requireKey(keyId) {
    const key = this.storedKey(keyId);
    if (!key) {
      throw new Error('Önce Ayarlar bölümünden bir YouTube API anahtarı kaydet.');
    }
    return key;
  }

  shouldPollComments(channel, force) {
    if (force) return true;
    const last = this.lastCommentsAt.get(channel.id) || 0;
    const interval =
      channel.commentsScope === 'videos' ? COMMENTS_VIDEOS_INTERVAL_MS : COMMENTS_CHANNEL_INTERVAL_MS;
    return Date.now() - last >= interval;
  }

  pushEvent(base) {
    const state = this.store.get();
    if (!state.youtubeChannels.some((channel) => channel.channelId === base.channelId)) return;
    const event = {
      id: base.id,
      companyId: base.companyId,
      channelId: base.channelId,
      channelTitle: base.channelTitle,
      kind: base.kind,
      at: base.at,
      author: base.author || null,
      text: base.text || null,
      videoId: base.videoId || null,
      videoTitle: base.videoTitle || null,
      count: Number.isFinite(base.count) ? base.count : null,
    };
    if (state.youtubeEvents.some((item) => item.id === event.id)) return;
    state.youtubeEvents.unshift(event);
    if (state.youtubeEvents.length > EVENTS_LIMIT) state.youtubeEvents.length = EVENTS_LIMIT;
    this.newEvents.push(event);
  }

  async pollComments(channel, key) {
    try {
      const { scope, comments } = await fetchComments(channel, key);
      if (!this.store.get().youtubeChannels.some((item) => item.id === channel.id)) return;
      const previousSeen = new Set(
        Array.isArray(channel.seenCommentIds) ? channel.seenCommentIds : [],
      );
      const initialized = Boolean(channel.commentsInitialized);
      if (initialized) {
        for (const comment of comments) {
          if (previousSeen.has(comment.id)) continue;
          this.pushEvent({
            id: `ytc_${comment.id}`,
            companyId: channel.companyId,
            channelId: channel.channelId,
            channelTitle: channel.title,
            kind: 'comment',
            at: comment.publishedAt ? Date.parse(comment.publishedAt) : Date.now(),
            author: comment.author,
            text: comment.text,
            videoId: comment.videoId,
            videoTitle: comment.videoTitle,
          });
        }
      }
      channel.commentsScope = scope;
      channel.commentsError = null;
      channel.commentsInitialized = true;
      channel.seenCommentIds = [...new Set([...comments.map((comment) => comment.id), ...previousSeen])].slice(
        0,
        SEEN_COMMENTS_LIMIT,
      );
      channel.recentComments = comments.slice(0, RECENT_COMMENTS_LIMIT);
    } catch (err) {
      channel.commentsError = errorMessage(err);
    }
    this.lastCommentsAt.set(channel.id, Date.now());
  }

  async pollChannel(channel, key, { force = false } = {}) {
    if (!this.store.get().youtubeChannels.some((item) => item.id === channel.id)) return;
    let item;
    try {
      item = await getChannelById(channel.channelId, key);
      if (!item) {
        throw new YoutubeApiError('channelNotFound', 'YouTube kanalı bulunamadı.');
      }
    } catch (err) {
      channel.lastError = errorMessage(err);
      this.store.save();
      return;
    }

    const snapshot = snapshotOf(item);
    const wasInitialized = typeof channel.lastCheckedAt === 'number';
    const previousSubscribers = channel.subscribers;

    channel.title = snapshot.title;
    channel.handle = snapshot.handle || channel.handle;
    channel.subscribers = snapshot.subscribers;
    channel.hiddenSubscribers = snapshot.hiddenSubscribers;
    channel.views = snapshot.views;
    channel.videos = snapshot.videos;
    channel.lastCheckedAt = Date.now();
    channel.lastError = null;

    if (!channel.avatar && snapshot.avatarUrl) {
      channel.avatar = await fetchAvatar(snapshot.avatarUrl);
    }

    if (
      wasInitialized &&
      !channel.hiddenSubscribers &&
      Number.isFinite(previousSubscribers) &&
      Number.isFinite(channel.subscribers) &&
      channel.subscribers > previousSubscribers
    ) {
      this.pushEvent({
        id: `yts_${channel.id}_${Date.now()}_${channel.subscribers}`,
        companyId: channel.companyId,
        channelId: channel.channelId,
        channelTitle: channel.title,
        kind: 'subscriber',
        at: Date.now(),
        count: channel.subscribers - previousSubscribers,
      });
    }

    if (this.shouldPollComments(channel, force)) {
      await this.pollComments(channel, key);
    }
    this.store.save();
  }

  async pollAll({ force = false } = {}) {
    if (this.running) return;
    this.newEvents = [];
    const state = this.store.get();
    const channels = [...state.youtubeChannels];
    if (!channels.length) return;

    this.running = true;
    try {
      const keyCache = new Map();
      for (const channel of channels) {
        if (!this.store.get().youtubeChannels.some((item) => item.id === channel.id)) continue;
        const cacheKey = channel.keyId || '__default__';
        let key = keyCache.get(cacheKey);
        if (!key) {
          try {
            key = this.requireKey(channel.keyId);
            keyCache.set(cacheKey, key);
          } catch (err) {
            channel.lastError =
              err && err.message
                ? err.message
                : 'YouTube API anahtarı açılamadı. Ayarlardan yeniden kaydet.';
            continue;
          }
        }
        await this.pollChannel(channel, key.value, { force });
      }
      this.store.save();
    } finally {
      this.running = false;
      this.broadcast();
    }
  }

  async refresh() {
    if (!(this.store.get().youtubeKeys || []).length) {
      throw new Error('Önce Ayarlar bölümünden bir YouTube API anahtarı kaydet.');
    }
    await this.pollAll({ force: true });
  }

  async addChannel(companyId, input, keyId) {
    const key = this.requireKey(keyId);
    const state = this.store.get();
    if (state.youtubeChannels.some((channel) => channel.companyId === companyId)) {
      throw new Error('Bu şirkete zaten bir YouTube kanalı bağlı.');
    }
    const reference = parseChannelInput(input);
    const item = await resolveChannel(reference, key.value);
    if (state.youtubeChannels.some((channel) => channel.channelId === item.id)) {
      throw new Error('Bu YouTube kanalı zaten bağlı.');
    }
    const snapshot = snapshotOf(item);
    const channel = {
      id: crypto.randomUUID(),
      companyId,
      channelId: item.id,
      keyId: key.id,
      handle: snapshot.handle,
      title: snapshot.title,
      avatar: null,
      subscribers: snapshot.subscribers,
      hiddenSubscribers: snapshot.hiddenSubscribers,
      views: snapshot.views,
      videos: snapshot.videos,
      commentsScope: null,
      recentComments: [],
      lastCheckedAt: null,
      lastError: null,
      commentsError: null,
      createdAt: Date.now(),
      seenCommentIds: [],
      commentsInitialized: false,
    };
    if (snapshot.avatarUrl) channel.avatar = await fetchAvatar(snapshot.avatarUrl);
    state.youtubeChannels.unshift(channel);
    this.store.save();
    this.newEvents = [];
    await this.pollChannel(channel, key.value, { force: true });
    this.store.save();
    this.broadcast();
    return channel;
  }

  removeChannel(id) {
    const state = this.store.get();
    const channel = state.youtubeChannels.find((item) => item.id === id);
    state.youtubeChannels = state.youtubeChannels.filter((item) => item.id !== id);
    if (channel) {
      state.youtubeEvents = state.youtubeEvents.filter((event) => event.channelId !== channel.channelId);
    }
    this.lastCommentsAt.delete(id);
    this.store.save();
  }

  broadcast() {
    if (typeof this.onUpdate !== 'function') return;
    const state = this.store.get();
    const channels = state.youtubeChannels.map(({ seenCommentIds, commentsInitialized, ...channel }) => channel);
    this.onUpdate({
      channels,
      events: state.youtubeEvents,
      newEvents: this.newEvents,
    });
  }
}

module.exports = { YoutubeMonitor, testKey, cleanKey, parseChannelInput };
