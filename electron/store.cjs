'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_FEED_URL } = require('./updates.cjs');

const YOUTUBE_KEY_SECRET_ID = 'youtube_api_key';
const YOUTUBE_KEY_SECRET_PREFIX = 'youtube_key:';

function youtubeKeySecretId(id) {
  return `${YOUTUBE_KEY_SECRET_PREFIX}${id}`;
}

function defaultState() {
  return {
    version: 1,
    companies: [],
    assets: [],
    mailAccounts: [],
    youtubeKeys: [],
    youtubeChannels: [],
    youtubeEvents: [],
    tasks: [],
    notes: [],
    finance: [],
    salaries: [],
    invoices: [],
    customerPayments: [],
    subscriptions: [],
    chatThreads: [],
    chatMessages: [],
    announcements: [],
    meetings: [],
    notificationReads: [],
    clients: [],
    contracts: [],
    documents: [],
    bugs: [],
    automationRules: [],
    securityEvents: [],
    employees: [],
    projects: [],
    approvals: [],
    departments: [],
    roles: [],
    performanceReviews: [],
    connections: [],
    playlist: [],
    settings: {
      currency: 'TRY',
      pollIntervalSec: 60,
      openAtLogin: false,
      language: 'tr',
      clockFormat: '24h',
      showSeconds: false,
      startPage: 'dashboard',
      notifications: false,
      theme: 'night',
      maximized: false,
      reduceMotion: false,
      autoUpdate: true,
      updateFeedUrl: DEFAULT_FEED_URL,
      lastSeenVersion: null,
      translateSource: 'en',
      translateTarget: 'tr',
      musicVolume: 0.75,
    },
    statuses: {},
    secrets: {},
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCompany(company) {
  const source = company && typeof company === 'object' ? company : {};
  return {
    id: source.id,
    name: source.name,
    color: typeof source.color === 'string' ? source.color : '#3ef2b5',
    logo: typeof source.logo === 'string' && source.logo.trim() ? source.logo : null,
    description: typeof source.description === 'string' ? source.description : '',
    status: ['active', 'maintenance', 'paused'].includes(source.status) ? source.status : 'active',
    category: ['studio', 'platform', 'game', 'agency', 'store', 'music', 'other'].includes(
      source.category,
    )
      ? source.category
      : 'other',
    monthlyTarget:
      typeof source.monthlyTarget === 'number' &&
      Number.isFinite(source.monthlyTarget) &&
      source.monthlyTarget > 0
        ? source.monthlyTarget
        : null,
    links: asArray(source.links),
    createdAt: source.createdAt,
  };
}

function normalizeMailAccount(account) {
  const source = account && typeof account === 'object' ? account : {};
  return {
    id: source.id,
    label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : '',
    email: typeof source.email === 'string' ? source.email.trim().toLowerCase() : '',
    provider: 'gmail',
    color: typeof source.color === 'string' ? source.color : '#3ef2b5',
    createdAt: source.createdAt,
    lastSyncAt: typeof source.lastSyncAt === 'number' ? source.lastSyncAt : null,
    lastError: typeof source.lastError === 'string' ? source.lastError : null,
  };
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\r\n?/g, '\n').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeYoutubeComment(comment) {
  const source = comment && typeof comment === 'object' ? comment : {};
  if (typeof source.id !== 'string' || !source.id) return null;
  const text = cleanText(source.text, 600);
  if (!text) return null;
  return {
    id: source.id.slice(0, 120),
    author: cleanText(source.author, 80) || 'YouTube',
    text,
    publishedAt: typeof source.publishedAt === 'string' ? source.publishedAt : null,
    likeCount: nullableNumber(source.likeCount),
    videoId: typeof source.videoId === 'string' ? source.videoId.slice(0, 20) : null,
    videoTitle: typeof source.videoTitle === 'string' ? source.videoTitle.slice(0, 200) : null,
  };
}

function normalizeYoutubeKey(key) {
  const source = key && typeof key === 'object' ? key : {};
  if (typeof source.id !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(source.id)) return null;
  return {
    id: source.id,
    label: cleanText(source.label, 60) || 'YouTube anahtarı',
    isDefault: Boolean(source.isDefault),
    createdAt: nullableNumber(source.createdAt) || Date.now(),
    lastTestedAt: nullableNumber(source.lastTestedAt),
    lastError: typeof source.lastError === 'string' ? source.lastError.slice(0, 300) : null,
  };
}

function normalizeYoutubeChannel(channel) {
  const source = channel && typeof channel === 'object' ? channel : {};
  if (typeof source.id !== 'string' || !source.id) return null;
  if (typeof source.channelId !== 'string' || !source.channelId) return null;
  return {
    id: source.id,
    companyId: source.companyId,
    channelId: source.channelId,
    keyId:
      typeof source.keyId === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(source.keyId)
        ? source.keyId
        : null,
    handle: typeof source.handle === 'string' && source.handle.trim() ? source.handle.trim() : null,
    title: cleanText(source.title, 200) || 'YouTube',
    avatar:
      typeof source.avatar === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(source.avatar)
        ? source.avatar
        : null,
    subscribers: nullableNumber(source.subscribers),
    hiddenSubscribers: Boolean(source.hiddenSubscribers),
    views: nullableNumber(source.views),
    videos: nullableNumber(source.videos),
    commentsScope: ['channel', 'videos'].includes(source.commentsScope) ? source.commentsScope : null,
    recentComments: asArray(source.recentComments)
      .map(normalizeYoutubeComment)
      .filter(Boolean)
      .slice(0, 12),
    lastCheckedAt: nullableNumber(source.lastCheckedAt),
    lastError: typeof source.lastError === 'string' ? source.lastError : null,
    commentsError: typeof source.commentsError === 'string' ? source.commentsError : null,
    createdAt: nullableNumber(source.createdAt) || Date.now(),
    seenCommentIds: asArray(source.seenCommentIds)
      .filter((id) => typeof id === 'string')
      .slice(0, 200),
    commentsInitialized: Boolean(source.commentsInitialized),
  };
}

const CONNECTION_PLATFORMS = ['youtube', 'instagram', 'tiktok'];

function normalizeConnection(connection) {
  const source = connection && typeof connection === 'object' ? connection : {};
  if (typeof source.id !== 'string' || !source.id) return null;
  if (!CONNECTION_PLATFORMS.includes(source.platform)) return null;
  return {
    id: source.id.slice(0, 64),
    platform: source.platform,
    label: cleanText(source.label, 80) || 'Hesap',
    externalId: typeof source.externalId === 'string' ? source.externalId.slice(0, 120) : null,
    handle: typeof source.handle === 'string' ? source.handle.slice(0, 80) : null,
    avatar:
      typeof source.avatar === 'string' && /^https?:\/\//i.test(source.avatar)
        ? source.avatar.slice(0, 500)
        : null,
    status: ['active', 'unverified', 'needs_attention'].includes(source.status)
      ? source.status
      : 'unverified',
    lastError: typeof source.lastError === 'string' ? source.lastError.slice(0, 400) : null,
    expiresAt: nullableNumber(source.expiresAt),
    isPrimary: Boolean(source.isPrimary),
    meta: source.meta && typeof source.meta === 'object' ? source.meta : {},
    createdAt: nullableNumber(source.createdAt) || Date.now(),
    updatedAt: nullableNumber(source.updatedAt) || Date.now(),
  };
}

function normalizeTrack(track) {
  const source = track && typeof track === 'object' ? track : {};
  if (typeof source.id !== 'string' || !source.id) return null;
  if (typeof source.file !== 'string' || !source.file) return null;
  return {
    id: source.id.slice(0, 64),
    title: cleanText(source.title, 120) || 'Parça',
    artist: typeof source.artist === 'string' ? source.artist.slice(0, 120) : '',
    file: source.file.slice(0, 160),
    mime: typeof source.mime === 'string' ? source.mime.slice(0, 80) : 'audio/mpeg',
    size: nullableNumber(source.size) || 0,
    addedAt: nullableNumber(source.addedAt) || Date.now(),
  };
}

function normalizeYoutubeEvent(event) {
  const source = event && typeof event === 'object' ? event : {};
  if (typeof source.id !== 'string' || !source.id) return null;
  if (!['comment', 'subscriber'].includes(source.kind)) return null;
  if (typeof source.channelId !== 'string' || !source.channelId) return null;
  return {
    id: source.id.slice(0, 160),
    companyId: source.companyId,
    channelId: source.channelId,
    channelTitle: cleanText(source.channelTitle, 200) || 'YouTube',
    kind: source.kind,
    at: nullableNumber(source.at) || Date.now(),
    author: typeof source.author === 'string' ? source.author.slice(0, 80) : null,
    text: typeof source.text === 'string' ? source.text.slice(0, 600) : null,
    videoId: typeof source.videoId === 'string' ? source.videoId.slice(0, 20) : null,
    videoTitle: typeof source.videoTitle === 'string' ? source.videoTitle.slice(0, 200) : null,
    count: nullableNumber(source.count),
  };
}

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'app-state.json');
    this.state = defaultState();
    this._timer = null;
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const base = defaultState();
      const rawSettings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
      const settings = { ...base.settings, ...rawSettings };
      delete settings.fullscreen;
      settings.theme = ['night', 'violet', 'ice', 'lime'].includes(rawSettings.theme)
        ? rawSettings.theme
        : base.settings.theme;
      settings.maximized = Boolean(rawSettings.maximized ?? rawSettings.fullscreen);
      settings.reduceMotion = Boolean(rawSettings.reduceMotion);
      if (!String(settings.updateFeedUrl || '').trim()) {
        settings.updateFeedUrl = DEFAULT_FEED_URL;
      }

      const secrets = raw.secrets && typeof raw.secrets === 'object' ? raw.secrets : {};
      const youtubeKeys = asArray(raw.youtubeKeys).map(normalizeYoutubeKey).filter(Boolean);
      const youtubeChannels = asArray(raw.youtubeChannels)
        .map(normalizeYoutubeChannel)
        .filter(Boolean);

      // Eski tek anahtarı adaşı korunarak yeni anahtar listesine taşı.
      if (!youtubeKeys.length && secrets[YOUTUBE_KEY_SECRET_ID]) {
        const id = 'default';
        youtubeKeys.push({
          id,
          label: 'Varsayılan YouTube anahtarı',
          isDefault: true,
          createdAt: Date.now(),
          lastTestedAt: null,
          lastError: null,
        });
        secrets[youtubeKeySecretId(id)] = secrets[YOUTUBE_KEY_SECRET_ID];
        delete secrets[YOUTUBE_KEY_SECRET_ID];
      }

      let defaultKey = youtubeKeys.find((key) => key.isDefault) || youtubeKeys[0] || null;
      if (defaultKey) {
        defaultKey.isDefault = true;
        for (const key of youtubeKeys) {
          if (key !== defaultKey) key.isDefault = false;
        }
      }
      const keyIds = new Set(youtubeKeys.map((key) => key.id));
      for (const channel of youtubeChannels) {
        if (!channel.keyId || !keyIds.has(channel.keyId)) {
          channel.keyId = defaultKey ? defaultKey.id : null;
        }
      }

      this.state = {
        ...base,
        ...raw,
        companies: asArray(raw.companies).map(normalizeCompany),
        assets: asArray(raw.assets),
        mailAccounts: asArray(raw.mailAccounts).map(normalizeMailAccount),
        youtubeKeys,
        youtubeChannels,
        youtubeEvents: asArray(raw.youtubeEvents)
          .map(normalizeYoutubeEvent)
          .filter(Boolean)
          .sort((a, b) => b.at - a.at)
          .slice(0, 500),
        tasks: asArray(raw.tasks),
        notes: asArray(raw.notes),
        finance: asArray(raw.finance),
        salaries: asArray(raw.salaries),
        invoices: asArray(raw.invoices),
        customerPayments: asArray(raw.customerPayments),
        subscriptions: asArray(raw.subscriptions),
        chatThreads: asArray(raw.chatThreads),
        chatMessages: asArray(raw.chatMessages),
        announcements: asArray(raw.announcements),
        meetings: asArray(raw.meetings),
        notificationReads: asArray(raw.notificationReads),
        clients: asArray(raw.clients),
        contracts: asArray(raw.contracts),
        documents: asArray(raw.documents),
        bugs: asArray(raw.bugs),
        automationRules: asArray(raw.automationRules),
        securityEvents: asArray(raw.securityEvents),
        employees: asArray(raw.employees),
        projects: asArray(raw.projects),
        approvals: asArray(raw.approvals),
        departments: asArray(raw.departments),
        roles: asArray(raw.roles),
        performanceReviews: asArray(raw.performanceReviews),
        connections: asArray(raw.connections).map(normalizeConnection).filter(Boolean),
        playlist: asArray(raw.playlist).map(normalizeTrack).filter(Boolean),
        settings,
        statuses: raw.statuses && typeof raw.statuses === 'object' ? raw.statuses : {},
        secrets,
      };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        try {
          fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`);
        } catch {
          /* ignore backup failure */
        }
        console.error('[store] durum dosyası okunamadı:', err.message);
      }
    }
  }

  get() {
    return this.state;
  }

  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, 120);
  }

  flush() {
    try {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      try {
        fs.renameSync(tmp, this.file);
      } catch {
        fs.copyFileSync(tmp, this.file);
        fs.unlinkSync(tmp);
      }
    } catch (err) {
      console.error('[store] yazılamadı:', err.message);
    }
  }

  flushNow() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.flush();
  }
}

function toRendererState(state) {
  const { secrets, ...rest } = state;
  const youtubeKeys = asArray(state.youtubeKeys).map((key) => {
    const secret = state.secrets[youtubeKeySecretId(key.id)];
    return {
      ...key,
      hasKey: Boolean(secret && secret.enc),
      hint: secret && secret.hint ? secret.hint : null,
      channelCount: asArray(state.youtubeChannels).filter((channel) => channel.keyId === key.id)
        .length,
    };
  });
  const defaultKey = youtubeKeys.find((key) => key.isDefault) || youtubeKeys[0] || null;
  return {
    ...rest,
    assets: state.assets.map((asset) => {
      const secret = state.secrets[asset.id];
      return {
        ...asset,
        hasSecret: Boolean(secret && secret.enc),
        secretHint: secret && secret.hint ? secret.hint : null,
      };
    }),
    mailAccounts: asArray(state.mailAccounts).map((account) => {
      const secret = state.secrets[account.id];
      return {
        ...account,
        hasSecret: Boolean(secret && secret.enc),
        secretHint: secret && secret.hint ? secret.hint : null,
      };
    }),
    connections: asArray(state.connections).map((connection) => {
      const secret = state.secrets[connection.id];
      return {
        ...connection,
        hasToken: Boolean(secret && secret.enc),
        tokenHint: secret && secret.hint ? secret.hint : null,
      };
    }),
    playlist: asArray(state.playlist).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      mime: track.mime,
      size: track.size,
      addedAt: track.addedAt,
      src: `ezwin-audio://track/${track.id}`,
    })),
    youtubeChannels: asArray(state.youtubeChannels).map(
      ({ seenCommentIds, commentsInitialized, ...channel }) => channel,
    ),
    youtubeEvents: asArray(state.youtubeEvents),
    youtubeKey: {
      hasKey: Boolean(defaultKey && defaultKey.hasKey),
      hint: defaultKey ? defaultKey.hint : null,
    },
    youtubeKeys,
  };
}

module.exports = {
  Store,
  toRendererState,
  defaultState,
  youtubeKeySecretId,
  YOUTUBE_KEY_SECRET_ID,
};
