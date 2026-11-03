import { tGlobal } from '../i18n/core';
import { normalizeLanguage } from '../i18n/languages';
import type {
  AppData,
  Asset,
  AssetType,
  Company,
  CompanyCategory,
  CompanyStatus,
  FinanceEntry,
  EzwinApi,
  HistoryPoint,
  LanguageCode,
  LinkItem,
  Meta,
  Note,
  RatesPayload,
  ServiceStatus,
  Settings,
  Task,
} from '../types';

const STORAGE_KEY = 'ezwin.hub.web.v1';
const SAVED_AT_KEY = 'ezwin.hub.web.savedAt.v1';
const RATES_KEY = 'ezwin.hub.web.rates.v1';
const RATES_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR';
const RATES_MAX_AGE = 15 * 60 * 1000;
const WEB_VERSION = '1.4.1';

const COMPANY_STATUSES: CompanyStatus[] = ['active', 'maintenance', 'paused'];
const COMPANY_CATEGORIES: CompanyCategory[] = [
  'studio',
  'platform',
  'game',
  'agency',
  'store',
  'music',
  'other',
];
const ASSET_TYPES: AssetType[] = ['discord', 'pterodactyl', 'website'];
const START_PAGES = ['dashboard', 'services', 'companies', 'finance', 'tasks', 'tools'] as const;

type StatusListener = (statuses: Record<string, ServiceStatus>) => void;
const statusListeners = new Set<StatusListener>();

export interface BrowserSaveState {
  at: number;
  ok: boolean;
}

type SaveListener = (state: BrowserSaveState) => void;
const saveListeners = new Set<SaveListener>();

export function onBrowserSave(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

export function browserSavedAt(): number {
  try {
    const value = Number(localStorage.getItem(SAVED_AT_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function reportBrowserSave(ok: boolean): void {
  reportSave(ok);
}

function reportSave(ok: boolean): void {
  let at = 0;
  if (ok) {
    at = Date.now();
    try {
      localStorage.setItem(SAVED_AT_KEY, String(at));
    } catch {
      /* the timestamp is cosmetic; the state write already succeeded */
    }
  }
  for (const listener of saveListeners) {
    try {
      listener({ at, ok });
    } catch {
      /* a broken indicator must not break persistence */
    }
  }
}

const DEFAULT_SETTINGS: Settings = {
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
  autoUpdate: false,
  updateFeedUrl: '',
  lastSeenVersion: null,
  translateSource: 'tr',
  translateTarget: 'en',
  musicVolume: 0.7,
};

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeColor(value: unknown): string {
  const color = asString(value);
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#3ef2b5';
}

function safeImage(value: unknown): string | null {
  const image = asString(value);
  if (!image) return null;
  if (image.startsWith('data:image/') || image.startsWith('https://') || image.startsWith('http://')) {
    return image;
  }
  if (!image.includes(':') && !image.startsWith('/') && !image.includes('\\')) {
    return image;
  }
  return null;
}

function safeUrl(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeLink(raw: unknown): LinkItem | null {
  if (!isRecord(raw)) return null;
  const label = asString(raw.label);
  const url = safeUrl(raw.url);
  if (!label || !url) return null;
  return { id: asString(raw.id) || uid(), label, url };
}

function normalizeCompany(raw: unknown, index: number): Company | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const status = COMPANY_STATUSES.includes(raw.status as CompanyStatus)
    ? (raw.status as CompanyStatus)
    : 'active';
  const category = COMPANY_CATEGORIES.includes(raw.category as CompanyCategory)
    ? (raw.category as CompanyCategory)
    : 'other';
  const target = asNumber(raw.monthlyTarget, 0);
  return {
    id: asString(raw.id) || `company-${index}-${uid()}`,
    name,
    color: safeColor(raw.color),
    logo: safeImage(raw.logo),
    description: asString(raw.description),
    status,
    category,
    monthlyTarget: target > 0 ? target : null,
    links: asArray(raw.links)
      .map(normalizeLink)
      .filter((link): link is LinkItem => Boolean(link)),
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function normalizeAsset(raw: unknown, index: number, companyIds: Set<string>): Asset | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const type = ASSET_TYPES.includes(raw.type as AssetType)
    ? (raw.type as AssetType)
    : 'website';
  const config = isRecord(raw.config) ? raw.config : {};
  const url = safeUrl(config.url);
  const baseUrl = safeUrl(config.baseUrl);
  return {
    id: asString(raw.id) || `asset-${index}-${uid()}`,
    companyId,
    type,
    name,
    config: {
      ...(url ? { url } : {}),
      ...(baseUrl ? { baseUrl } : {}),
    },
    createdAt: asNumber(raw.createdAt, Date.now()),
    hasSecret: false,
    secretHint: null,
  };
}

function normalizeTask(raw: unknown, companyIds: Set<string>): Task | null {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  if (!title) return null;
  const companyId = asString(raw.companyId);
  const priority = raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'med';
  const due = asString(raw.due);
  return {
    id: asString(raw.id) || uid(),
    title,
    companyId: companyIds.has(companyId) ? companyId : null,
    priority,
    due: due || null,
    done: Boolean(raw.done),
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function normalizeNote(raw: unknown, companyIds: Set<string>): Note | null {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (!title && !body.trim()) return null;
  const companyId = asString(raw.companyId);
  const createdAt = asNumber(raw.createdAt, Date.now());
  return {
    id: asString(raw.id) || uid(),
    title: title || tGlobal('Adsız not'),
    body,
    companyId: companyIds.has(companyId) ? companyId : null,
    pinned: Boolean(raw.pinned),
    createdAt,
    updatedAt: asNumber(raw.updatedAt, createdAt),
  };
}

function normalizeFinance(raw: unknown, companyIds: Set<string>): FinanceEntry | null {
  if (!isRecord(raw)) return null;
  const companyId = asString(raw.companyId);
  if (!companyIds.has(companyId)) return null;
  const amount = asNumber(raw.amount, 0);
  if (!(amount > 0)) return null;
  const kind = raw.kind === 'expense' ? 'expense' : 'income';
  const date = asString(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    id: asString(raw.id) || uid(),
    companyId,
    kind,
    amount,
    category: asString(raw.category),
    note: asString(raw.note),
    date,
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function normalizeSettings(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {};
  const currency = ['TRY', 'USD', 'EUR'].includes(asString(source.currency))
    ? (asString(source.currency) as Settings['currency'])
    : DEFAULT_SETTINGS.currency;
  const theme = ['night', 'violet', 'ice', 'lime'].includes(asString(source.theme))
    ? (asString(source.theme) as Settings['theme'])
    : DEFAULT_SETTINGS.theme;
  const startPage = START_PAGES.includes(asString(source.startPage) as (typeof START_PAGES)[number])
    ? (asString(source.startPage) as Settings['startPage'])
    : 'dashboard';
  const pollIntervalSec = [30, 60, 120, 300, 600].includes(asNumber(source.pollIntervalSec))
    ? asNumber(source.pollIntervalSec)
    : DEFAULT_SETTINGS.pollIntervalSec;
  const translateSource = /^[a-z]{2}$/.test(asString(source.translateSource))
    ? asString(source.translateSource)
    : DEFAULT_SETTINGS.translateSource;
  const translateTarget = /^[a-z]{2}$/.test(asString(source.translateTarget))
    ? asString(source.translateTarget)
    : DEFAULT_SETTINGS.translateTarget;
  return {
    currency,
    pollIntervalSec,
    openAtLogin: false,
    language: normalizeLanguage(source.language),
    clockFormat: source.clockFormat === '12h' ? '12h' : '24h',
    showSeconds: Boolean(source.showSeconds),
    startPage,
    notifications: Boolean(source.notifications),
    theme,
    maximized: false,
    reduceMotion: Boolean(source.reduceMotion),
    autoUpdate: false,
    updateFeedUrl: '',
    lastSeenVersion: null,
    translateSource,
    translateTarget,
    musicVolume: 0.7,
  };
}

function emptyState(): AppData {
  return {
    version: 1,
    companies: [],
    assets: [],
    mailAccounts: [],
    youtubeChannels: [],
    youtubeEvents: [],
    youtubeKey: { hasKey: false, hint: null },
    youtubeKeys: [],
    tasks: [],
    notes: [],
    finance: [],
    connections: [],
    playlist: [],
    settings: { ...DEFAULT_SETTINGS },
    statuses: {},
  };
}

function unwrapState(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (isRecord(raw.data)) return raw.data;
  if (isRecord(raw.state)) return raw.state;
  return raw;
}

function normalizeHistory(raw: unknown): HistoryPoint | null {
  if (!isRecord(raw)) return null;
  const t = asNumber(raw.t, 0);
  if (!t) return null;
  return {
    t,
    ok: raw.ok === true,
    ms: typeof raw.ms === 'number' && Number.isFinite(raw.ms) ? raw.ms : null,
  };
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeStatuses(
  raw: unknown,
  assetIds: Set<string>,
): Record<string, ServiceStatus> {
  if (!isRecord(raw)) return {};
  const statuses: Record<string, ServiceStatus> = {};
  for (const assetId of Object.keys(raw)) {
    if (!assetIds.has(assetId)) continue;
    const status = raw[assetId];
    if (!isRecord(status)) continue;
    if (status.state !== 'online' && status.state !== 'degraded' && status.state !== 'offline') {
      continue;
    }
    const checkedAt = asNumber(status.checkedAt, 0);
    if (!checkedAt) continue;
    const entry: ServiceStatus = {
      assetId,
      checkedAt,
      state: status.state,
      latencyMs: finiteOrNull(status.latencyMs),
      summary: asString(status.summary),
      error: asString(status.error) || null,
    };
    if (isRecord(status.website)) {
      const website = status.website;
      entry.website = {
        statusCode: finiteOrNull(website.statusCode),
        sslExpiresAt: finiteOrNull(website.sslExpiresAt),
        history: asArray(website.history)
          .map(normalizeHistory)
          .filter((point): point is HistoryPoint => Boolean(point))
          .slice(-30),
      };
    }
    if (isRecord(status.discord)) {
      const discord = status.discord;
      entry.discord = {
        botId: asString(discord.botId),
        username: asString(discord.username) || 'Bot',
        guildCount: finiteOrNull(discord.guildCount) ?? undefined,
        guilds: asArray(discord.guilds)
          .filter(isRecord)
          .map((guild) => ({ id: asString(guild.id), name: asString(guild.name) }))
          .filter((guild) => Boolean(guild.id))
          .slice(0, 200),
      };
    }
    if (isRecord(status.pterodactyl)) {
      const panel = status.pterodactyl;
      entry.pterodactyl = {
        account: asString(panel.account) || null,
        total: asNumber(panel.total, 0),
        servers: asArray(panel.servers)
          .filter(isRecord)
          .map((server) => ({
            id: asString(server.id),
            name: asString(server.name),
            state: asString(server.state),
            cpuPercent: finiteOrNull(server.cpuPercent),
            memoryMb: finiteOrNull(server.memoryMb),
            memoryLimitMb: finiteOrNull(server.memoryLimitMb),
            diskMb: finiteOrNull(server.diskMb),
            diskLimitMb: finiteOrNull(server.diskLimitMb),
            uptimeMs: finiteOrNull(server.uptimeMs),
          }))
          .filter((server) => Boolean(server.id)),
      };
    }
    statuses[assetId] = entry;
  }
  return statuses;
}

export function normalizeState(raw: unknown): AppData {
  const source = unwrapState(raw);
  if (!isRecord(source)) return emptyState();

  const companies = asArray(source.companies)
    .map(normalizeCompany)
    .filter((company): company is Company => Boolean(company));
  const companyIds = new Set(companies.map((company) => company.id));
  const assets = asArray(source.assets)
    .map((asset, index) => normalizeAsset(asset, index, companyIds))
    .filter((asset): asset is Asset => Boolean(asset));
  const assetIds = new Set(assets.map((asset) => asset.id));

  return {
    version: 1,
    companies,
    assets,
    mailAccounts: [],
    youtubeChannels: [],
    youtubeEvents: [],
    youtubeKey: { hasKey: false, hint: null },
    youtubeKeys: [],
    tasks: asArray(source.tasks)
      .map((task) => normalizeTask(task, companyIds))
      .filter((task): task is Task => Boolean(task)),
    notes: asArray(source.notes)
      .map((note) => normalizeNote(note, companyIds))
      .filter((note): note is Note => Boolean(note)),
    finance: asArray(source.finance)
      .map((entry) => normalizeFinance(entry, companyIds))
      .filter((entry): entry is FinanceEntry => Boolean(entry)),
    connections: [],
    playlist: [],
    settings: normalizeSettings(source.settings),
    statuses: normalizeStatuses(source.statuses, assetIds),
  };
}

function readState(): AppData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('Tarayıcı depolamasına erişilemiyor. Gizli mod veya site verisi engeli olabilir.');
  }
  if (!raw) return emptyState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    try {
      localStorage.setItem(`${STORAGE_KEY}.bozuk.${Date.now()}`, raw);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore recovery failure */
    }
    return emptyState();
  }
}

function writeState(state: AppData): AppData {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    reportSave(false);
    throw new Error('Tarayıcı depolaması dolu. JSON yedeği alıp eski kayıtları sil.');
  }
  reportSave(true);
  return state;
}

export function checkpointBrowserSave(): void {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) return;
    writeState(readState());
  } catch {
    /* writeState already surfaced the failure */
  }
}

export function applyServiceStatuses(next: Record<string, ServiceStatus>): void {
  if (!Object.keys(next).length) return;
  const state = readState();
  state.statuses = { ...state.statuses, ...next };
  writeState(state);
  for (const listener of statusListeners) listener(state.statuses);
}

export function clearServiceStatuses(ids: string[]): void {
  if (!ids.length) return;
  const state = readState();
  let changed = false;
  for (const id of ids) {
    if (!state.statuses[id]) continue;
    delete state.statuses[id];
    changed = true;
  }
  if (!changed) return;
  writeState(state);
  for (const listener of statusListeners) listener(state.statuses);
}

export function findAssetId(
  companyId: string,
  name: string,
  type: AssetType,
): string | null {
  const state = readState();
  for (let index = state.assets.length - 1; index >= 0; index -= 1) {
    const asset = state.assets[index];
    if (asset.companyId === companyId && asset.name === name && asset.type === type) {
      return asset.id;
    }
  }
  return null;
}

function meta(): Meta {
  return {
    appVersion: WEB_VERSION,
    secureStorage: false,
    dataPath: 'Tarayıcı localStorage',
    platform: 'web',
  };
}

function unsupported(): never {
  throw new Error(tGlobal('Bu özellik web sürümünde kullanılamıyor.'));
}

function findCompany(state: AppData, id: string): Company {
  const company = state.companies.find((item) => item.id === id);
  if (!company) throw new Error('Şirket bulunamadı.');
  return company;
}

export function exportPayload(state = readState()): {
  exportedAt: string;
  note: string;
  data: AppData;
} {
  return {
    exportedAt: new Date().toISOString(),
    note: 'API anahtarları ve gizli değerler bu yedekte yer almaz.',
    data: state,
  };
}

function downloadJson(payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ezwin-hub-web-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function importBackup(text: string): {
  companies: number;
  assets: number;
  tasks: number;
  notes: number;
  finance: number;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Yedek dosyası okunamadı.');
  }
  const source = unwrapState(parsed);
  if (!isRecord(source)) throw new Error('Yedek dosyası geçersiz.');
  const known = ['companies', 'assets', 'tasks', 'notes', 'finance', 'settings'].some(
    (key) => key in source,
  );
  if (!known) throw new Error('Yedek dosyası geçersiz.');
  const next = normalizeState(source);
  writeState(next);
  return {
    companies: next.companies.length,
    assets: next.assets.length,
    tasks: next.tasks.length,
    notes: next.notes.length,
    finance: next.finance.length,
  };
}

export async function loadPortfolioSeed(): Promise<{ companies: number; assets: number }> {
  const response = await fetch('seed/ezwin-portfolio.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Portföy dosyası yüklenemedi.');
  const seed = normalizeState(await response.json());
  const current = readState();
  if (current.companies.length > 0) {
    throw new Error('Portföy yalnızca boş bir çalışma alanına yüklenebilir.');
  }
  const next: AppData = {
    ...current,
    companies: seed.companies,
    assets: seed.assets,
    statuses: {},
  };
  writeState(next);
  return { companies: seed.companies.length, assets: seed.assets.length };
}

export function setStoredLanguage(language: LanguageCode): void {
  try {
    const state = readState();
    state.settings = { ...state.settings, language: normalizeLanguage(language) };
    writeState(state);
  } catch {
    /* language preference is optional */
  }
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('ezwin.hub.tray.v1');
    localStorage.removeItem(SAVED_AT_KEY);
  } catch {
    throw new Error('Tarayıcı verisi temizlenemedi.');
  }
  for (const listener of saveListeners) {
    try {
      listener({ at: 0, ok: true });
    } catch {
      /* ignore listener errors */
    }
  }
}

export function storageBytes(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}

function readRatesCache(): RatesPayload | null {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesPayload;
    if (
      !parsed ||
      typeof parsed.fetchedAt !== 'number' ||
      typeof parsed.rates?.TRY !== 'number' ||
      typeof parsed.rates?.EUR !== 'number'
    ) {
      return null;
    }
    return { ...parsed, stale: true };
  } catch {
    return null;
  }
}

async function fetchRates(): Promise<RatesPayload> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(RATES_URL, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Kur alınamadı');
    const body = (await response.json()) as {
      date?: string;
      rates?: { TRY?: number; EUR?: number };
    };
    const tryRate = Number(body.rates?.TRY);
    const eurRate = Number(body.rates?.EUR);
    if (!Number.isFinite(tryRate) || !Number.isFinite(eurRate)) {
      throw new Error('Kur alınamadı');
    }
    const payload: RatesPayload = {
      base: 'USD',
      rates: { TRY: tryRate, EUR: eurRate },
      fetchedAt: Date.now(),
      rateDate: typeof body.date === 'string' ? body.date : null,
      source: 'ECB referans kurları',
      stale: false,
      error: null,
    };
    try {
      localStorage.setItem(RATES_KEY, JSON.stringify(payload));
    } catch {
      /* rates still usable without cache */
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function rates(force: boolean): Promise<RatesPayload> {
  const cached = readRatesCache();
  if (!force && cached && Date.now() - cached.fetchedAt < RATES_MAX_AGE) {
    return { ...cached, stale: false };
  }
  try {
    return await fetchRates();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kur alınamadı';
    if (cached) return { ...cached, stale: true, error: message };
    throw new Error('Kur alınamadı');
  }
}

export function installBrowserApi(): void {
  if (window.ezwin) return;

  const api: EzwinApi = {
    getInitial: async () => ({ state: readState(), meta: meta() }),
    company: {
      create: async (input) => {
        const state = readState();
        const name = asString(input.name);
        if (!name) throw new Error('Şirket adı gerekli.');
        const company: Company = {
          id: uid(),
          name,
          color: safeColor(input.color),
          logo: safeImage(input.logo),
          description: asString(input.description),
          status: COMPANY_STATUSES.includes(input.status as CompanyStatus)
            ? (input.status as CompanyStatus)
            : 'active',
          category: COMPANY_CATEGORIES.includes(input.category as CompanyCategory)
            ? (input.category as CompanyCategory)
            : 'other',
          monthlyTarget:
            typeof input.monthlyTarget === 'number' && input.monthlyTarget > 0
              ? input.monthlyTarget
              : null,
          links: asArray(input.links)
            .map(normalizeLink)
            .filter((link): link is LinkItem => Boolean(link)),
          createdAt: Date.now(),
        };
        state.companies.push(company);
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const company = findCompany(state, input.id);
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Şirket adı gerekli.');
          company.name = name;
        }
        if (input.color !== undefined) company.color = safeColor(input.color);
        if (input.logo !== undefined) company.logo = safeImage(input.logo);
        if (input.description !== undefined) company.description = asString(input.description);
        if (input.status !== undefined && COMPANY_STATUSES.includes(input.status)) {
          company.status = input.status;
        }
        if (input.category !== undefined && COMPANY_CATEGORIES.includes(input.category)) {
          company.category = input.category;
        }
        if (input.monthlyTarget !== undefined) {
          company.monthlyTarget =
            typeof input.monthlyTarget === 'number' && input.monthlyTarget > 0
              ? input.monthlyTarget
              : null;
        }
        if (input.links !== undefined) {
          company.links = asArray(input.links)
            .map(normalizeLink)
            .filter((link): link is LinkItem => Boolean(link));
        }
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.companies.some((company) => company.id === id)) {
          throw new Error('Şirket bulunamadı.');
        }
        const assetIds = new Set(
          state.assets.filter((asset) => asset.companyId === id).map((asset) => asset.id),
        );
        state.companies = state.companies.filter((company) => company.id !== id);
        state.assets = state.assets.filter((asset) => asset.companyId !== id);
        state.tasks = state.tasks.filter((task) => task.companyId !== id);
        state.notes = state.notes.filter((note) => note.companyId !== id);
        state.finance = state.finance.filter((entry) => entry.companyId !== id);
        for (const assetId of assetIds) delete state.statuses[assetId];
        return writeState(state);
      },
    },
    asset: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        const name = asString(input.name);
        if (!name) throw new Error('Servis adı gerekli.');
        if (!ASSET_TYPES.includes(input.type)) throw new Error('Bilinmeyen servis türü');
        const asset: Asset = {
          id: uid(),
          companyId: input.companyId,
          type: input.type,
          name,
          config: {
            ...(safeUrl(input.config?.url) ? { url: safeUrl(input.config?.url) ?? undefined } : {}),
            ...(safeUrl(input.config?.baseUrl)
              ? { baseUrl: safeUrl(input.config?.baseUrl) ?? undefined }
              : {}),
          },
          createdAt: Date.now(),
          hasSecret: false,
          secretHint: null,
        };
        state.assets.push(asset);
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const asset = state.assets.find((item) => item.id === input.id);
        if (!asset) throw new Error('Servis bulunamadı.');
        if (input.name !== undefined) {
          const name = asString(input.name);
          if (!name) throw new Error('Servis adı gerekli.');
          asset.name = name;
        }
        if (input.companyId !== undefined) {
          findCompany(state, input.companyId);
          asset.companyId = input.companyId;
        }
        if (input.config !== undefined) {
          asset.config = {
            ...(safeUrl(input.config.url) ? { url: safeUrl(input.config.url) ?? undefined } : {}),
            ...(safeUrl(input.config.baseUrl)
              ? { baseUrl: safeUrl(input.config.baseUrl) ?? undefined }
              : {}),
          };
        }
        asset.hasSecret = false;
        asset.secretHint = null;
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.assets.some((asset) => asset.id === id)) throw new Error('Servis bulunamadı.');
        state.assets = state.assets.filter((asset) => asset.id !== id);
        delete state.statuses[id];
        return writeState(state);
      },
      test: async () => ({
        ok: false,
        state: 'unchecked',
        message: tGlobal('Tarayıcı sürümünde canlı API testi yapılamaz.'),
      }),
    },
    task: {
      create: async (input) => {
        const state = readState();
        const title = asString(input.title);
        if (!title) throw new Error('Görev başlığı gerekli.');
        const companyId = input.companyId && state.companies.some((c) => c.id === input.companyId)
          ? input.companyId
          : null;
        state.tasks.push({
          id: uid(),
          title,
          companyId,
          priority: input.priority ?? 'med',
          due: asString(input.due) || null,
          done: false,
          createdAt: Date.now(),
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const task = state.tasks.find((item) => item.id === input.id);
        if (!task) throw new Error('Görev bulunamadı.');
        if (input.title !== undefined) {
          const title = asString(input.title);
          if (!title) throw new Error('Görev başlığı gerekli.');
          task.title = title;
        }
        if (input.companyId !== undefined) {
          task.companyId =
            input.companyId && state.companies.some((c) => c.id === input.companyId)
              ? input.companyId
              : null;
        }
        if (input.priority !== undefined) task.priority = input.priority;
        if (input.due !== undefined) task.due = asString(input.due) || null;
        if (input.done !== undefined) task.done = Boolean(input.done);
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.tasks.some((task) => task.id === id)) throw new Error('Görev bulunamadı.');
        state.tasks = state.tasks.filter((task) => task.id !== id);
        return writeState(state);
      },
    },
    note: {
      create: async (input) => {
        const state = readState();
        const title = asString(input.title);
        const body = typeof input.body === 'string' ? input.body : '';
        if (!title && !body.trim()) throw new Error('Not başlığı gerekli.');
        const now = Date.now();
        state.notes.push({
          id: uid(),
          title: title || tGlobal('Adsız not'),
          body,
          companyId:
            input.companyId && state.companies.some((c) => c.id === input.companyId)
              ? input.companyId
              : null,
          pinned: Boolean(input.pinned),
          createdAt: now,
          updatedAt: now,
        });
        return writeState(state);
      },
      update: async (input) => {
        const state = readState();
        const note = state.notes.find((item) => item.id === input.id);
        if (!note) throw new Error('Not bulunamadı.');
        if (input.title !== undefined) note.title = asString(input.title) || tGlobal('Adsız not');
        if (input.body !== undefined) note.body = typeof input.body === 'string' ? input.body : '';
        if (input.companyId !== undefined) {
          note.companyId =
            input.companyId && state.companies.some((c) => c.id === input.companyId)
              ? input.companyId
              : null;
        }
        if (input.pinned !== undefined) note.pinned = Boolean(input.pinned);
        note.updatedAt = Date.now();
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.notes.some((note) => note.id === id)) throw new Error('Not bulunamadı.');
        state.notes = state.notes.filter((note) => note.id !== id);
        return writeState(state);
      },
    },
    finance: {
      create: async (input) => {
        const state = readState();
        findCompany(state, input.companyId);
        if (!(input.amount > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Geçerli bir tarih gir.');
        state.finance.push({
          id: uid(),
          companyId: input.companyId,
          kind: input.kind === 'expense' ? 'expense' : 'income',
          amount: input.amount,
          category: asString(input.category),
          note: asString(input.note),
          date: input.date,
          createdAt: Date.now(),
        });
        return writeState(state);
      },
      remove: async (id) => {
        const state = readState();
        if (!state.finance.some((entry) => entry.id === id)) throw new Error('Kayıt bulunamadı.');
        state.finance = state.finance.filter((entry) => entry.id !== id);
        return writeState(state);
      },
    },
    settings: {
      update: async (input) => {
        const state = readState();
        const next: Settings = {
          ...state.settings,
          ...(input.language !== undefined ? { language: normalizeLanguage(input.language) } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.clockFormat !== undefined ? { clockFormat: input.clockFormat } : {}),
          ...(input.showSeconds !== undefined ? { showSeconds: input.showSeconds } : {}),
          ...(input.startPage !== undefined ? { startPage: input.startPage } : {}),
          ...(input.notifications !== undefined ? { notifications: input.notifications } : {}),
          ...(input.theme !== undefined ? { theme: input.theme } : {}),
          ...(input.reduceMotion !== undefined ? { reduceMotion: input.reduceMotion } : {}),
          ...(input.translateSource !== undefined && /^[a-z]{2}$/.test(input.translateSource)
            ? { translateSource: input.translateSource }
            : {}),
          ...(input.translateTarget !== undefined && /^[a-z]{2}$/.test(input.translateTarget)
            ? { translateTarget: input.translateTarget }
            : {}),
          ...(input.pollIntervalSec !== undefined
            ? { pollIntervalSec: input.pollIntervalSec }
            : {}),
        };
        state.settings = normalizeSettings(next);
        return writeState(state);
      },
      testNotification: async () => {
        if (!('Notification' in window)) return false;
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') return false;
        new Notification('EZWIN HUB', { body: tGlobal('Test bildirimi gönderildi.') });
        return true;
      },
    },
    mail: {
      accounts: async () => [],
      test: async () => ({
        ok: false,
        message: tGlobal('Gmail hesapları tarayıcı sürümünde kullanılamıyor.'),
      }),
      add: async () => unsupported(),
      update: async () => unsupported(),
      remove: async () => unsupported(),
      list: async () => ({ messages: [], accounts: [], errors: [], unreadCounts: {} }),
      read: async () => unsupported(),
      star: async () => false,
    },
    youtube: {
      addKey: async () => unsupported(),
      updateKey: async () => unsupported(),
      removeKey: async () => unsupported(),
      setDefaultKey: async () => unsupported(),
      testKey: async () => ({
        ok: false,
        message: tGlobal('Bu özellik web sürümünde kullanılamıyor.'),
      }),
      addChannel: async () => unsupported(),
      setChannelKey: async () => unsupported(),
      removeChannel: async () => unsupported(),
      refresh: async () => unsupported(),
    },
    monitor: {
      refresh: async () => readState(),
    },
    session: {
      get: async () => ({ account: null, accounts: [], locked: false, meta: meta() }),
      register: async () => unsupported(),
      login: async () => unsupported(),
      verify2fa: async () => unsupported(),
      setup2fa: async () => unsupported(),
      enable2fa: async () => unsupported(),
      disable2fa: async () => unsupported(),
      backup2fa: async () => unsupported(),
      logout: async () => ({ locked: false, accounts: [] }),
      update: async () => unsupported(),
      changePassword: async () => unsupported(),
      security: async () => unsupported(),
    },
    assistant: {
      status: async () => ({
        provider: 'web',
        endpoint: '',
        model: '',
        modelLabel: '',
        hasKey: false,
        ready: false,
      }),
      ask: async () => unsupported(),
    },
    connections: {
      platforms: async () => [],
      add: async () => unsupported(),
      verify: async () => unsupported(),
      refresh: async () => unsupported(),
      primary: async () => unsupported(),
      remove: async () => unsupported(),
    },
    music: {
      import: async () => unsupported(),
      remove: async () => unsupported(),
      rename: async () => unsupported(),
    },
    translate: {
      languages: async () => [],
      run: async () => unsupported(),
    },
    updates: {
      notes: async () => ({
        currentVersion: WEB_VERSION,
        entries: [],
        lastSeenVersion: null,
        feedUrl: '',
        autoUpdate: false,
      }),
      check: async () => ({
        configured: false,
        available: false,
        currentVersion: WEB_VERSION,
        message: tGlobal('Web sürümünde otomatik güncelleme yok.'),
      }),
      markSeen: async () => readState(),
      saveSettings: async () => readState(),
      download: async () => unsupported(),
      install: async () => unsupported(),
    },
    rates: {
      get: () => rates(false),
      refresh: () => rates(true),
    },
    app: {
      openExternal: async (url) => {
        const target = safeUrl(url);
        if (!target) return false;
        window.open(target, '_blank', 'noopener,noreferrer');
        return true;
      },
      exportData: async () => {
        downloadJson(exportPayload());
        return { canceled: false, path: 'indirilenler' };
      },
      revealData: async () => false,
      copyText: (text) => {
        void navigator.clipboard?.writeText(text).catch(() => {
          const area = document.createElement('textarea');
          area.value = text;
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        });
      },
    },
    onStatuses: (callback) => {
      statusListeners.add(callback);
      return () => {
        statusListeners.delete(callback);
      };
    },
    onYoutube: () => () => {},
    onFullscreen: () => () => {},
    onMaximized: () => () => {},
    onUpdateAvailable: () => () => {},
  };

  window.ezwin = api;
  (window as Window & { ezwinWeb?: boolean }).ezwinWeb = true;
}
