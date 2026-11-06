import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { APP_VERSION } from '../lib/appVersion';
import { IS_ANDROID_APP } from '../lib/native';
import { IS_TRAY } from '../lib/runtime';
import { onTrayHostMessage } from './trayBridge';

const RELEASES_URL = 'https://api.github.com/repos/EzWinStudio/Orbita/releases/latest';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const CHECK_KEY = 'orbita.update.checkedAt';

export interface UpdateState {
  supported: boolean;
  platform: 'desktop' | 'android' | null;
  currentVersion: string;
  latest: string | null;
  available: boolean;
  downloaded: boolean;
  checking: boolean;
  downloading: boolean;
  progress: number | null;
  error: string | null;
  checkedAt: number | null;
  notes: string[];
}

interface DesktopUpdatePayload {
  supported?: boolean;
  currentVersion?: string;
  latest?: string | null;
  available?: boolean;
  downloaded?: boolean;
  downloading?: boolean;
  progress?: number | null;
  error?: string | null;
  checkedAt?: number | null;
  notes?: string[];
}

interface DesktopUpdatesApi {
  status: () => Promise<DesktopUpdatePayload | null>;
  check: () => Promise<DesktopUpdatePayload | null>;
  install: () => Promise<{ ok?: boolean; error?: string } | null>;
}

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface ReleasePayload {
  tag_name?: string;
  body?: string;
  assets?: ReleaseAsset[];
}

interface NativeUpdaterPlugin {
  getVersion: () => Promise<{ versionName?: string; versionCode?: number }>;
  canInstall: () => Promise<{ allowed?: boolean }>;
  openInstallSettings: () => Promise<void>;
  downloadAndInstall: (options: {
    url: string;
    sha256: string;
    version: string;
  }) => Promise<{ ok?: boolean; sha256?: string; size?: number }>;
  addListener: (
    event: 'downloadProgress',
    handler: (data: { percent?: number; received?: number; total?: number }) => void,
  ) => Promise<PluginListenerHandle>;
}

const NativeUpdater = registerPlugin<NativeUpdaterPlugin>('OrbitaUpdater');

let state: UpdateState = {
  supported: false,
  platform: null,
  currentVersion: APP_VERSION,
  latest: null,
  available: false,
  downloaded: false,
  checking: false,
  downloading: false,
  progress: null,
  error: null,
  checkedAt: null,
  notes: [],
};

let started = false;
let checkInFlight: Promise<UpdateState> | null = null;
let androidRelease: { url: string; sha256: string; version: string } | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      /* a broken listener must not stop the others */
    }
  }
}

export function getUpdateState(): UpdateState {
  return state;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function compareVersions(left: string, right: string): number {
  const a = String(left || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const first = a[index] ?? 0;
    const second = b[index] ?? 0;
    if (first > second) return 1;
    if (first < second) return -1;
  }
  return 0;
}

function desktopApi(): DesktopUpdatesApi | null {
  const host = (window as Window & { ezwinHost?: { updates?: DesktopUpdatesApi } }).ezwinHost;
  return host?.updates ?? null;
}

function releaseNotes(body: unknown): string[] {
  return String(body || '')
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

function applyDesktop(payload: DesktopUpdatePayload | null): void {
  if (!payload) {
    setState({ checking: false, error: 'check_failed' });
    return;
  }
  setState({
    supported: payload.supported !== false,
    platform: 'desktop',
    currentVersion: payload.currentVersion || state.currentVersion || APP_VERSION,
    latest: payload.latest ?? null,
    available: Boolean(payload.available),
    downloaded: Boolean(payload.downloaded),
    downloading: Boolean(payload.downloading),
    checking: false,
    progress: typeof payload.progress === 'number' ? payload.progress : null,
    error: typeof payload.error === 'string' && payload.error ? payload.error : null,
    checkedAt: typeof payload.checkedAt === 'number' ? payload.checkedAt : null,
    notes: Array.isArray(payload.notes) ? payload.notes.map(String).slice(0, 6) : [],
  });
}

async function initializeAndroid(): Promise<void> {
  try {
    const info = await NativeUpdater.getVersion();
    setState({
      supported: true,
      platform: 'android',
      currentVersion: info.versionName || APP_VERSION,
    });
  } catch {
    setState({ supported: true, platform: 'android', currentVersion: APP_VERSION });
  }
  try {
    await NativeUpdater.addListener('downloadProgress', (data) => {
      if (typeof data.percent === 'number') setState({ progress: data.percent });
    });
  } catch {
    /* progress events are optional */
  }
}

async function checkAndroid(force: boolean): Promise<UpdateState> {
  const last = Number(window.localStorage.getItem(CHECK_KEY) || 0);
  if (!force && Number.isFinite(last) && Date.now() - last < CHECK_INTERVAL && state.latest) {
    return state;
  }
  setState({ checking: true, error: null });
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('release_unavailable');
    const release = (await response.json()) as ReleasePayload;
    const latest = String(release.tag_name || '')
      .replace(/^v/i, '')
      .trim();
    if (!latest) throw new Error('release_invalid');
    const notes = releaseNotes(release.body);
    const apkName = `Orbita-Android-${latest}.apk`;
    const apk = (release.assets || []).find((asset) => asset.name === apkName);
    const checksum = (release.assets || []).find(
      (asset) => asset.name === `${apkName}.sha256`,
    );
    const available = compareVersions(latest, state.currentVersion || APP_VERSION) > 0;
    if (available && (!apk?.browser_download_url || !checksum?.browser_download_url)) {
      throw new Error('release_assets_missing');
    }
    let sha256 = '';
    if (available && checksum?.browser_download_url) {
      const checksumResponse = await fetch(checksum.browser_download_url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!checksumResponse.ok) throw new Error('checksum_unavailable');
      const match = (await checksumResponse.text()).match(/[a-f0-9]{64}/i);
      if (!match) throw new Error('checksum_unavailable');
      sha256 = match[0].toLowerCase();
    }
    androidRelease =
      available && apk?.browser_download_url
        ? { url: apk.browser_download_url, sha256, version: latest }
        : null;
    window.localStorage.setItem(CHECK_KEY, String(Date.now()));
    setState({
      checking: false,
      latest,
      available,
      downloaded: false,
      downloading: false,
      progress: null,
      error: null,
      checkedAt: Date.now(),
      notes,
    });
  } catch {
    setState({
      checking: false,
      downloading: false,
      progress: null,
      error: 'check_failed',
      checkedAt: Date.now(),
    });
  }
  return state;
}

export function checkForUpdate(force = false): Promise<UpdateState> {
  if (checkInFlight) return checkInFlight;
  if (IS_TRAY) {
    const api = desktopApi();
    if (!api) {
      setState({ supported: false });
      return Promise.resolve(state);
    }
    setState({ checking: true, error: null });
    checkInFlight = api
      .check()
      .then((payload) => {
        applyDesktop(payload);
        return state;
      })
      .catch(() => {
        setState({ checking: false, error: 'check_failed' });
        return state;
      })
      .finally(() => {
        checkInFlight = null;
      });
    return checkInFlight;
  }
  if (!IS_ANDROID_APP) return Promise.resolve(state);
  checkInFlight = checkAndroid(force).finally(() => {
    checkInFlight = null;
  });
  return checkInFlight;
}

export async function installUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (IS_TRAY) {
    const api = desktopApi();
    if (!api) return { ok: false, error: 'unsupported' };
    setState({ error: null, checking: false });
    try {
      const result = await api.install();
      if (result?.ok) return { ok: true };
      setState({ error: result?.error || 'install_failed' });
      return { ok: false, error: result?.error || 'install_failed' };
    } catch {
      setState({ error: 'install_failed' });
      return { ok: false, error: 'install_failed' };
    }
  }

  if (!IS_ANDROID_APP) return { ok: false, error: 'unsupported' };
  if (!androidRelease) {
    await checkForUpdate(true);
  }
  if (!androidRelease) {
    setState({ error: 'not_ready' });
    return { ok: false, error: 'not_ready' };
  }

  try {
    const permission = await NativeUpdater.canInstall().catch(() => ({ allowed: true }));
    if (permission.allowed === false) {
      setState({ error: 'permission_required' });
      return { ok: false, error: 'permission_required' };
    }
    setState({ downloading: true, progress: 0, error: null });
    await NativeUpdater.downloadAndInstall({
      url: androidRelease.url,
      sha256: androidRelease.sha256,
      version: androidRelease.version,
    });
    setState({ downloading: false, downloaded: true, progress: 100 });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes('checksum')
      ? 'checksum_mismatch'
      : message.includes('permission')
        ? 'permission_required'
        : message.startsWith('download_failed')
          ? 'download_failed'
          : 'install_failed';
    setState({ downloading: false, progress: null, error: code });
    return { ok: false, error: code };
  }
}

export async function openInstallPermission(): Promise<void> {
  if (!IS_ANDROID_APP) return;
  try {
    await NativeUpdater.openInstallSettings();
  } catch {
    /* settings screen is not available */
  }
}

export function startUpdateAgent(): void {
  if (started) return;
  if (!IS_TRAY && !IS_ANDROID_APP) return;
  started = true;

  if (IS_TRAY) {
    setState({ supported: true, platform: 'desktop', currentVersion: APP_VERSION });
    onTrayHostMessage((message) => {
      if (message.kind !== 'update-status') return;
      applyDesktop(message as DesktopUpdatePayload);
    });
    const api = desktopApi();
    if (!api) {
      setState({ supported: false });
      return;
    }
    void api
      .status()
      .then((payload) => applyDesktop(payload))
      .catch(() => setState({ checking: false }));
    return;
  }

  setState({ supported: true, platform: 'android', currentVersion: APP_VERSION });
  void initializeAndroid();
  window.setTimeout(() => void checkForUpdate(false), 12000);
  window.setInterval(() => void checkForUpdate(false), CHECK_INTERVAL);
}
