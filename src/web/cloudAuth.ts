import {
  clearCloudSession,
  getCloudSession,
  setLastCloudEmail,
  updateCloudSessionAccount,
  writeCloudSession,
  type AuthSession,
  type LocalAccount,
  type LoginInput,
  type RegisterInput,
} from './webAuth';
import { IS_ANDROID_APP, NATIVE_API_BASE } from '../lib/native';

export class CloudUnavailableError extends Error {
  constructor() {
    super('cloud_unavailable');
    this.name = 'CloudUnavailableError';
  }
}

export class CloudAuthError extends Error {
  code: string;
  retryAfter: number;

  constructor(code: string, retryAfter = 0) {
    super(code);
    this.name = 'CloudAuthError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

interface CloudAccountPayload {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  avatar?: unknown;
  color?: unknown;
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

interface CloudReply {
  ok?: unknown;
  code?: unknown;
  retryAfter?: unknown;
  account?: unknown;
  expiresAt?: unknown;
  token?: unknown;
}

const REQUEST_TIMEOUT = 8_000;
const SESSION_TIMEOUT = 6_000;
const NATIVE_TOKEN_KEY = 'orbita.native.session';

function readNativeToken(): string {
  if (!IS_ANDROID_APP) return '';
  try {
    return window.localStorage.getItem(NATIVE_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function saveNativeToken(value: unknown): void {
  if (!IS_ANDROID_APP) return;
  const token = asString(value);
  if (!token) return;
  try {
    window.localStorage.setItem(NATIVE_TOKEN_KEY, token);
  } catch {
    /* storage can be unavailable; the cookie session remains */
  }
}

function clearNativeToken(): void {
  if (!IS_ANDROID_APP) return;
  try {
    window.localStorage.removeItem(NATIVE_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function nativeHeaders(): Record<string, string> {
  if (!IS_ANDROID_APP) return {};
  const token = readNativeToken();
  return {
    'X-Orbita-Client': 'android',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeAvatar(value: unknown): string | null {
  const avatar = asString(value);
  if (!avatar.startsWith('data:image/')) return null;
  return avatar.length <= 2_500_000 ? avatar : null;
}

function normalizeAccount(value: unknown): LocalAccount | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as CloudAccountPayload;
  const id = asString(raw.id);
  const name = asString(raw.name).trim();
  const email = asString(raw.email).trim();
  if (!id || !name || !email) return null;
  const color = asString(raw.color);
  return {
    id,
    name,
    email,
    avatar: safeAvatar(raw.avatar),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#3ef2b5',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    lastLoginAt: typeof raw.lastLoginAt === 'number' ? raw.lastLoginAt : null,
  };
}

async function cloudRequest(
  path: string,
  init: RequestInit = {},
  timeout = REQUEST_TIMEOUT,
): Promise<CloudReply> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  let response: Response;
  try {
    response = await fetch(`${NATIVE_API_BASE}/api/auth/${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...nativeHeaders(),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new CloudUnavailableError();
  } finally {
    window.clearTimeout(timer);
  }

  if (response.status >= 500 || response.status === 404 || response.status === 405) {
    throw new CloudUnavailableError();
  }

  let body: CloudReply;
  try {
    body = (await response.json()) as CloudReply;
  } catch {
    throw new CloudUnavailableError();
  }

  if (!response.ok || body.ok === false) {
    const code = asString(body.code) || 'server_error';
    const retryAfter = typeof body.retryAfter === 'number' ? body.retryAfter : 0;
    throw new CloudAuthError(code, retryAfter);
  }
  return body;
}

function sessionExpiry(value: unknown): number {
  const raw = typeof value === 'number' ? value : 0;
  if (!raw) return 0;
  return raw < 1_000_000_000_000 ? raw * 1000 : raw;
}

async function adoptReply(body: CloudReply, remember: boolean): Promise<AuthSession> {
  const account = normalizeAccount(body.account);
  const expiresAt = sessionExpiry(body.expiresAt);
  if (!account || !expiresAt) throw new CloudUnavailableError();
  saveNativeToken(body.token);
  const session = { remember, expiresAt };
  writeCloudSession(account, session);
  setLastCloudEmail(account.email);
  return { account, session, cloud: true };
}

export async function loginCloudAccount(input: LoginInput): Promise<AuthSession> {
  const body = await cloudRequest('login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      remember: input.remember,
    }),
  });
  return adoptReply(body, input.remember);
}

export async function registerCloudAccount(input: RegisterInput): Promise<AuthSession> {
  const body = await cloudRequest('register', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      remember: input.remember,
    }),
  });
  return adoptReply(body, input.remember);
}

export async function validateCloudSession(): Promise<{
  status: 'ok' | 'invalid' | 'offline';
  account?: LocalAccount;
}> {
  const cached = getCloudSession();
  if (!cached) return { status: 'invalid' };
  try {
    const body = await cloudRequest('session', { method: 'GET' }, SESSION_TIMEOUT);
    const account = normalizeAccount(body.account);
    if (!account) return { status: 'offline' };
    const expiresAt = sessionExpiry(body.expiresAt) || cached.expiresAt;
    writeCloudSession(account, { remember: cached.remember, expiresAt });
    return { status: 'ok', account };
  } catch (error) {
    if (error instanceof CloudAuthError) {
      clearCloudSession();
      clearNativeToken();
      return { status: 'invalid' };
    }
    return { status: 'offline' };
  }
}

export function logoutCloudAccount(): void {
  const headers = nativeHeaders();
  clearCloudSession();
  clearNativeToken();
  void fetch(`${NATIVE_API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  }).catch(() => {
    /* the local session is already cleared */
  });
}

export async function updateCloudProfile(avatar: string | null): Promise<LocalAccount | null> {
  try {
    const body = await cloudRequest('profile', {
      method: 'PATCH',
      body: JSON.stringify({ avatar }),
    });
    const account = normalizeAccount(body.account);
    if (account) updateCloudSessionAccount(account);
    return account;
  } catch {
    return null;
  }
}
