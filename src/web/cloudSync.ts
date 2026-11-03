import type { AppData, Settings } from '../types';
import { applySyncedState, onBrowserSave, readBrowserState } from './browserApi';
import { scopedStorageKey } from './workspaceScope';
import { PRODUCT_NAME } from '../lib/product';

export const SYNC_ORIGIN = 'https://ezwin-hub-sync-qa7ckgs962s.qoder.website';
const CONFIG_KEY = 'ezwin.hub.web.sync.v1';
const BACKUP_KEY = 'ezwin.hub.web.sync.backup.v1';
const CODE_PREFIX = 'ORBITA';
const LEGACY_CODE_PREFIX = 'EZWIN';
const CODE_LENGTH = 26;
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const AAD_PREFIX = 'EZWINHUB1:';
const AUTO_PULL_MS = 20_000;
const AUTO_PUSH_DELAY_MS = 1_800;

interface SyncConfig {
  code: string;
  channelId: string;
  deviceId: string;
  lastVersion: number;
  lastSyncedAt: number;
  dirtyAt: number;
  lastFingerprint: string;
}

export type SyncPhase = 'disabled' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  enabled: boolean;
  phase: SyncPhase;
  code: string | null;
  lastSyncedAt: number;
  lastVersion: number;
  pending: boolean;
  error: string | null;
  lastAction: 'push' | 'pull' | 'conflict' | null;
}

export interface SyncResult {
  ok: boolean;
  action?: 'push' | 'pull' | 'conflict' | 'empty';
  error?: string;
}

const listeners = new Set<() => void>();
let status: SyncStatus = {
  enabled: false,
  phase: 'disabled',
  code: null,
  lastSyncedAt: 0,
  lastVersion: 0,
  pending: false,
  error: null,
  lastAction: null,
};

let syncing: Promise<SyncResult> | null = null;
let suppressAutoSync = false;
let agentCleanup: (() => void) | null = null;

function emit(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* a broken indicator must not break sync */
    }
  }
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

function readConfig(): SyncConfig | null {
  try {
    const raw = JSON.parse(
      localStorage.getItem(scopedStorageKey(CONFIG_KEY)) || 'null',
    ) as Partial<SyncConfig> | null;
    if (!raw || typeof raw.code !== 'string' || typeof raw.channelId !== 'string') return null;
    if (!/^[A-Za-z0-9_-]{22,64}$/.test(raw.channelId)) return null;
    return {
      code: raw.code,
      channelId: raw.channelId,
      deviceId: typeof raw.deviceId === 'string' && raw.deviceId ? raw.deviceId : createDeviceId(),
      lastVersion: Number.isFinite(raw.lastVersion) ? Number(raw.lastVersion) : 0,
      lastSyncedAt: Number.isFinite(raw.lastSyncedAt) ? Number(raw.lastSyncedAt) : 0,
      dirtyAt: Number.isFinite(raw.dirtyAt) ? Number(raw.dirtyAt) : 0,
      lastFingerprint: typeof raw.lastFingerprint === 'string' ? raw.lastFingerprint : '',
    };
  } catch {
    return null;
  }
}

function writeConfig(config: SyncConfig): void {
  try {
    localStorage.setItem(scopedStorageKey(CONFIG_KEY), JSON.stringify(config));
  } catch {
    /* the sync state is best effort; the local app data remains saved */
  }
}

function createDeviceId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

function concatBytes(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base32Encode(bytes: Uint8Array): string {
  let output = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32[(value >> bits) & 31];
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output.padEnd(CODE_LENGTH, '0').slice(0, CODE_LENGTH);
}

function normalizeCode(input: string): string | null {
  let clean = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (clean.length >= CODE_PREFIX.length + CODE_LENGTH && clean.startsWith(CODE_PREFIX)) {
    clean = clean.slice(CODE_PREFIX.length);
  } else if (
    clean.length >= LEGACY_CODE_PREFIX.length + CODE_LENGTH &&
    clean.startsWith(LEGACY_CODE_PREFIX)
  ) {
    clean = clean.slice(LEGACY_CODE_PREFIX.length);
  }
  clean = clean.replace(/[ILO]/g, (char) => (char === 'O' ? '0' : '1'));
  if (clean.length < CODE_LENGTH) return null;
  clean = clean.slice(0, CODE_LENGTH);
  for (const char of clean) {
    if (!BASE32.includes(char)) return null;
  }
  return clean;
}

function codeToBytes(clean: string): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  let value = 0;
  let bits = 0;
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 255);
    }
  }
  return new Uint8Array(bytes.slice(0, 16));
}

function formatCode(clean: string): string {
  return `${CODE_PREFIX}-${clean.slice(0, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 15)}-${clean.slice(15, 20)}-${clean.slice(20)}`;
}

export function generateSyncCode(): string {
  return formatCode(base32Encode(randomBytes(16)));
}

async function channelFromCode(clean: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    concatBytes(codeToBytes(clean), new TextEncoder().encode(':channel')),
  );
  return base64Url(new Uint8Array(digest).slice(0, 16));
}

async function aesKeyFromCode(clean: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    concatBytes(codeToBytes(clean), new TextEncoder().encode(':aes')),
  );
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSnapshot(snapshot: AppData, channelId: string): Promise<string> {
  const clean = normalizeCode(readConfig()?.code ?? '');
  if (!clean) throw new Error('sync_code_invalid');
  const key = await aesKeyFromCode(clean);
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(AAD_PREFIX + channelId),
    },
    key,
    plaintext,
  );
  return JSON.stringify({ v: 1, iv: base64Url(iv), data: base64Url(new Uint8Array(ciphertext)) });
}

async function decryptSnapshot(payload: string, channelId: string): Promise<unknown> {
  const clean = normalizeCode(readConfig()?.code ?? '');
  if (!clean) throw new Error('sync_code_invalid');
  let envelope: { v?: number; iv?: string; data?: string };
  try {
    envelope = JSON.parse(payload) as { v?: number; iv?: string; data?: string };
  } catch {
    throw new Error('sync_payload_invalid');
  }
  if (envelope.v !== 1 || typeof envelope.iv !== 'string' || typeof envelope.data !== 'string') {
    throw new Error('sync_payload_invalid');
  }
  const key = await aesKeyFromCode(clean);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64Url(envelope.iv),
      additionalData: new TextEncoder().encode(AAD_PREFIX + channelId),
    },
    key,
    fromBase64Url(envelope.data),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function sharedSettings(settings: Settings): Settings {
  return {
    ...settings,
    theme: 'night',
    language: 'tr',
    clockFormat: '24h',
    showSeconds: false,
    startPage: 'dashboard',
    maximized: false,
    reduceMotion: false,
    openAtLogin: false,
    autoUpdate: false,
    updateFeedUrl: '',
    lastSeenVersion: null,
  };
}

function snapshotOf(state: AppData): AppData {
  return {
    ...state,
    assets: state.assets.map((asset) => ({ ...asset, hasSecret: false, secretHint: null })),
    mailAccounts: state.mailAccounts.map((account) => ({
      ...account,
      hasSecret: false,
      secretHint: null,
    })),
    youtubeKeys: state.youtubeKeys.map((key) => ({ ...key, hasKey: false, hint: null })),
    youtubeKey: { hasKey: false, hint: null },
    statuses: {},
    settings: sharedSettings(state.settings),
  };
}

function fingerprintOf(state: AppData): string {
  const serialized = JSON.stringify(snapshotOf(state));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${serialized.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

function localIsEmpty(state: AppData): boolean {
  return (
    state.companies.length === 0 &&
    state.assets.length === 0 &&
    state.tasks.length === 0 &&
    state.notes.length === 0 &&
    state.finance.length === 0 &&
    state.mailAccounts.length === 0 &&
    state.youtubeChannels.length === 0
  );
}

function backupLocal(state: AppData): void {
  if (localIsEmpty(state)) return;
  try {
    localStorage.setItem(
      scopedStorageKey(BACKUP_KEY),
      JSON.stringify({ at: Date.now(), data: snapshotOf(state) }),
    );
  } catch {
    /* a backup is best effort; do not block sync on quota errors */
  }
}

interface FrameReply {
  status: number;
  body: unknown;
}

const framePending = new Map<
  string,
  { resolve: (reply: FrameReply) => void; reject: (error: Error) => void; timer: number }
>();
let syncFrame: HTMLIFrameElement | null = null;
let syncFrameReady = false;
let framePromise: Promise<void> | null = null;

function onFrameMessage(event: MessageEvent): void {
  if (event.origin !== SYNC_ORIGIN) return;
  const data = event.data as
    | { type?: string; requestId?: string; status?: number; body?: unknown }
    | null;
  if (!data) return;
  if (data.type === 'ezwin-sync-ready') {
    syncFrameReady = true;
    return;
  }
  if (data.type !== 'ezwin-sync-result' || typeof data.requestId !== 'string') return;
  const pending = framePending.get(data.requestId);
  if (!pending) return;
  framePending.delete(data.requestId);
  window.clearTimeout(pending.timer);
  pending.resolve({ status: Number(data.status) || 0, body: data.body });
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', onFrameMessage);
}

function ensureFrame(): Promise<void> {
  if (syncFrame && syncFrameReady) return Promise.resolve();
  if (framePromise) return framePromise;
  framePromise = new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.src = `${SYNC_ORIGIN}/?embed=1`;
    frame.title = `${PRODUCT_NAME} eşitleme`;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    frame.style.border = '0';
    const timer = window.setTimeout(() => {
      frame.remove();
      syncFrame = null;
      syncFrameReady = false;
      framePromise = null;
      reject(new Error('sync_unavailable'));
    }, 15_000);
    const check = window.setInterval(() => {
      if (!syncFrameReady) return;
      window.clearInterval(check);
      window.clearTimeout(timer);
      syncFrame = frame;
      resolve();
    }, 80);
    frame.addEventListener('error', () => {
      window.clearInterval(check);
      window.clearTimeout(timer);
      frame.remove();
      syncFrame = null;
      syncFrameReady = false;
      framePromise = null;
      reject(new Error('sync_unavailable'));
    });
    document.body.appendChild(frame);
  });
  return framePromise;
}

async function frameRequest(action: 'get' | 'put', payload: Record<string, unknown>): Promise<FrameReply> {
  await ensureFrame();
  if (!syncFrame?.contentWindow) throw new Error('sync_unavailable');
  const requestId = uid();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      framePending.delete(requestId);
      reject(new Error('sync_timeout'));
    }, 25_000);
    framePending.set(requestId, { resolve, reject, timer });
    syncFrame?.contentWindow?.postMessage(
      { type: 'ezwin-sync', requestId, action, ...payload },
      SYNC_ORIGIN,
    );
  });
}

async function getRemote(config: SyncConfig): Promise<{
  found: boolean;
  payload?: string;
  version: number;
  updatedAt: number;
}> {
  const reply = await frameRequest('get', { channel: config.channelId });
  const body = reply.body as
    | { ok?: boolean; found?: boolean; payload?: string; version?: number; updatedAt?: number }
    | null;
  if (reply.status !== 200 || !body?.ok) throw new Error('sync_unavailable');
  return {
    found: Boolean(body.found),
    payload: typeof body.payload === 'string' ? body.payload : undefined,
    version: Number(body.version) || 0,
    updatedAt: Number(body.updatedAt) || 0,
  };
}

function setStatusFromConfig(config: SyncConfig | null): void {
  if (!config) {
    emit({
      enabled: false,
      phase: 'disabled',
      code: null,
      lastSyncedAt: 0,
      lastVersion: 0,
      pending: false,
      error: null,
      lastAction: null,
    });
    return;
  }
  emit({
    enabled: true,
    phase: status.phase === 'syncing' ? 'syncing' : 'idle',
    code: config.code,
    lastSyncedAt: config.lastSyncedAt,
    lastVersion: config.lastVersion,
    pending: config.dirtyAt > config.lastSyncedAt,
    error: null,
  });
}

async function pushLocal(
  local: AppData,
  config: SyncConfig,
  expectedVersion: number,
): Promise<SyncResult> {
  const snapshot = snapshotOf(local);
  const payload = await encryptSnapshot(snapshot, config.channelId);
  const reply = await frameRequest('put', {
    channel: config.channelId,
    payload,
    expectedVersion,
    deviceId: config.deviceId,
  });
  const body = reply.body as
    | { ok?: boolean; code?: string; version?: number; updatedAt?: number }
    | null;
  if (reply.status === 409) {
    return { ok: false, action: 'conflict', error: 'sync_conflict' };
  }
  if (reply.status !== 200 || !body?.ok) throw new Error('sync_unavailable');
  const now = Date.now();
  const nextConfig: SyncConfig = {
    ...config,
    lastVersion: Number(body.version) || config.lastVersion + 1,
    lastSyncedAt: now,
    dirtyAt: 0,
    lastFingerprint: fingerprintOf(local),
  };
  writeConfig(nextConfig);
  setStatusFromConfig(nextConfig);
  emit({ phase: 'idle', lastAction: 'push', error: null });
  return { ok: true, action: 'push' };
}

async function pullRemote(
  remote: { found: boolean; payload?: string; version: number; updatedAt: number },
  config: SyncConfig,
): Promise<SyncResult> {
  if (!remote.found || !remote.payload) {
    return { ok: false, action: 'empty', error: 'sync_empty' };
  }
  const raw = await decryptSnapshot(remote.payload, config.channelId);
  const before = readBrowserState();
  backupLocal(before);
  suppressAutoSync = true;
  try {
    applySyncedState(raw);
  } finally {
    suppressAutoSync = false;
  }
  const applied = readBrowserState();
  const nextConfig: SyncConfig = {
    ...config,
    lastVersion: remote.version,
    lastSyncedAt: Date.now(),
    dirtyAt: 0,
    lastFingerprint: fingerprintOf(applied),
  };
  writeConfig(nextConfig);
  setStatusFromConfig(nextConfig);
  emit({ phase: 'idle', lastAction: 'pull', error: null });
  return { ok: true, action: 'pull' };
}

async function runSync(mode: 'auto' | 'pull' | 'push'): Promise<SyncResult> {
  const config = readConfig();
  if (!config) {
    setStatusFromConfig(null);
    return { ok: false, error: 'sync_disabled' };
  }
  if (!crypto?.subtle) {
    emit({ phase: 'error', error: 'sync_unsupported' });
    return { ok: false, error: 'sync_unsupported' };
  }
  emit({
    phase: 'syncing',
    enabled: true,
    code: config.code,
    lastSyncedAt: config.lastSyncedAt,
    lastVersion: config.lastVersion,
    pending: config.dirtyAt > config.lastSyncedAt,
    error: null,
  });
  try {
    const local = readBrowserState();
    const remote = await getRemote(config);
    if (!remote.found) {
      return await pushLocal(local, config, 0);
    }
    const remoteChanged = remote.version !== config.lastVersion;
    const localDirty = config.dirtyAt > config.lastSyncedAt;
    if (mode === 'pull' || (!localDirty && remoteChanged)) {
      return await pullRemote(remote, config);
    }
    if (mode === 'push' || localDirty) {
      if (remoteChanged && mode !== 'push') {
        const pulled = await pullRemote(remote, config);
        if (pulled.ok) {
          emit({ lastAction: 'conflict' });
          return { ok: true, action: 'conflict' };
        }
        return pulled;
      }
      const expected = remoteChanged ? remote.version : config.lastVersion;
      const pushed = await pushLocal(local, config, expected);
      if (pushed.ok) return pushed;
      if (pushed.action === 'conflict') {
        const latest = await getRemote(config);
        const pulled = await pullRemote(latest, config);
        if (pulled.ok) {
          emit({ lastAction: 'conflict' });
          return { ok: true, action: 'conflict' };
        }
        return pulled;
      }
      return pushed;
    }
    setStatusFromConfig(config);
    emit({ phase: 'idle', error: null });
    return { ok: true, action: 'empty' };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'sync_unavailable';
    const known = [
      'sync_unavailable',
      'sync_timeout',
      'sync_conflict',
      'sync_code_invalid',
      'sync_payload_invalid',
      'sync_unsupported',
    ].includes(code)
      ? code
      : 'sync_unavailable';
    emit({
      phase: 'error',
      error: known,
      pending: (() => {
        const current = readConfig();
        return current ? current.dirtyAt > current.lastSyncedAt : false;
      })(),
    });
    return { ok: false, error: known };
  }
}

export function syncNow(mode: 'auto' | 'pull' | 'push' = 'auto'): Promise<SyncResult> {
  if (syncing) return syncing;
  syncing = runSync(mode).finally(() => {
    syncing = null;
  });
  return syncing;
}

export async function createSync(): Promise<{ ok: boolean; code?: string; error?: string }> {
  const code = generateSyncCode();
  const clean = normalizeCode(code);
  if (!clean) return { ok: false, error: 'sync_code_invalid' };
  const config: SyncConfig = {
    code,
    channelId: await channelFromCode(clean),
    deviceId: createDeviceId(),
    lastVersion: 0,
    lastSyncedAt: 0,
    dirtyAt: Date.now(),
    lastFingerprint: '',
  };
  writeConfig(config);
  setStatusFromConfig(config);
  startSyncAgent();
  const result = await syncNow('push');
  return result.ok ? { ok: true, code } : { ok: false, code, error: result.error };
}

export async function connectSync(input: string): Promise<{ ok: boolean; error?: string }> {
  const clean = normalizeCode(input);
  if (!clean) return { ok: false, error: 'sync_code_invalid' };
  const config: SyncConfig = {
    code: formatCode(clean),
    channelId: await channelFromCode(clean),
    deviceId: createDeviceId(),
    lastVersion: 0,
    lastSyncedAt: 0,
    dirtyAt: 0,
    lastFingerprint: '',
  };
  try {
    const remote = await getRemote(config);
    if (!remote.found) return { ok: false, error: 'sync_empty' };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'sync_unavailable';
    const known = ['sync_unavailable', 'sync_timeout', 'sync_empty'].includes(code)
      ? code
      : 'sync_unavailable';
    return { ok: false, error: known };
  }
  writeConfig(config);
  setStatusFromConfig(config);
  startSyncAgent();
  const result = await syncNow('auto');
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export function disconnectSync(): void {
  try {
    localStorage.removeItem(scopedStorageKey(CONFIG_KEY));
  } catch {
    /* ignore */
  }
  stopSyncAgent();
  setStatusFromConfig(null);
}

export function getSyncCode(): string | null {
  return readConfig()?.code ?? null;
}

export function startSyncAgent(): () => void {
  if (agentCleanup) return agentCleanup;
  const config = readConfig();
  if (!config) {
    setStatusFromConfig(null);
    return () => {};
  }
  setStatusFromConfig(config);
  let saveTimer: number | null = null;

  const schedulePush = () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void syncNow('auto');
    }, AUTO_PUSH_DELAY_MS);
  };

  const onSave = () => {
    if (suppressAutoSync) return;
    const current = readConfig();
    if (!current) return;
    const fp = fingerprintOf(readBrowserState());
    if (fp === current.lastFingerprint) return;
    const next: SyncConfig = { ...current, dirtyAt: Date.now() };
    writeConfig(next);
    emit({ enabled: true, pending: true, lastVersion: next.lastVersion, lastSyncedAt: next.lastSyncedAt });
    schedulePush();
  };

  const offSave = onBrowserSave(onSave);
  const onFocus = () => {
    if (document.visibilityState === 'visible') void syncNow('auto');
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow('auto');
  }, AUTO_PULL_MS);
  const startup = window.setTimeout(() => void syncNow('auto'), 900);

  agentCleanup = () => {
    offSave();
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
    window.clearInterval(timer);
    window.clearTimeout(startup);
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    agentCleanup = null;
  };
  return agentCleanup;
}

export function stopSyncAgent(): void {
  agentCleanup?.();
  agentCleanup = null;
}
