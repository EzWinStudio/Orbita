export const AUTH_STORAGE_KEY = 'ezwin.hub.web.auth.v1';
export const SESSION_STORAGE_KEY = 'ezwin.hub.web.session.v1';
export const GUEST_STORAGE_KEY = 'ezwin.hub.web.guest.v1';
export const GUEST_AVATAR_KEY = 'ezwin.hub.web.guestAvatar.v1';

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const PASSWORD_ITERATIONS = 210_000;
const TAB_SESSION_MS = 24 * 60 * 60 * 1000;
const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const STORAGE_ERROR = 'Tarayıcı depolamasına erişilemiyor. Gizli mod veya site verisi engeli olabilir.';

export interface LocalAccount {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  color: string;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface LocalSession {
  remember: boolean;
  expiresAt: number;
}

export interface AuthSession {
  account: LocalAccount;
  session: LocalSession;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

interface StoredAccount extends LocalAccount {
  salt: string;
  hash: string;
  iterations: number;
}

interface StoredSession {
  version: 1;
  accountId: string;
  expiresAt: number;
  remember: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeAvatar(value: unknown): string | null {
  const avatar = asString(value);
  if (!avatar.startsWith('data:image/')) return null;
  return avatar.length <= 2_500_000 ? avatar : null;
}

function toPublic(account: StoredAccount): LocalAccount {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    avatar: normalizeAvatar(account.avatar),
    color: account.color,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
  };
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string, message: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    throw new Error(message);
  }
}

function removeStorage(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

function assertCrypto(): void {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Tarayıcıda güvenli kriptografi kullanılamıyor.');
  }
}

function createId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStoredAccount(raw: unknown): StoredAccount | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name).trim();
  const email = (asString(raw.email) || asString(raw.username)).trim();
  const salt = asString(raw.salt);
  const hash = asString(raw.hash);
  const iterations = typeof raw.iterations === 'number' ? raw.iterations : 0;
  if (!id || !name || !email || !salt || !hash) return null;
  if (!Number.isFinite(iterations) || iterations < 100_000) return null;
  try {
    if (atob(salt).length < 8 || atob(hash).length !== 32) return null;
  } catch {
    return null;
  }
  const color = asString(raw.color);
  return {
    id,
    name,
    email,
    avatar: normalizeAvatar(raw.avatar),
    salt,
    hash,
    iterations,
    color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#3ef2b5',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    lastLoginAt: typeof raw.lastLoginAt === 'number' ? raw.lastLoginAt : null,
  };
}

function readAccount(): StoredAccount | null {
  const raw = readStorage(localStorage, AUTH_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const source = isRecord(parsed) && isRecord(parsed.account) ? parsed.account : parsed;
  return normalizeStoredAccount(source);
}

function writeAccount(account: StoredAccount): void {
  writeStorage(
    localStorage,
    AUTH_STORAGE_KEY,
    JSON.stringify({ version: 1, account }),
    'Yerel hesap kaydedilemedi. Tarayıcı depolamasını kontrol et.',
  );
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const accountId = asString(parsed.accountId);
  const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0;
  if (!accountId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { version: 1, accountId, expiresAt, remember: Boolean(parsed.remember) };
}

function readSession(accountId: string): StoredSession | null {
  const persistent = parseSession(readStorage(localStorage, SESSION_STORAGE_KEY));
  if (persistent && persistent.accountId === accountId) return persistent;
  const tab = parseSession(readStorage(sessionStorage, SESSION_STORAGE_KEY));
  if (tab && tab.accountId === accountId) return tab;
  return null;
}

function clearSessions(): void {
  removeStorage(localStorage, SESSION_STORAGE_KEY);
  removeStorage(sessionStorage, SESSION_STORAGE_KEY);
}

function createSession(accountId: string, remember: boolean): LocalSession {
  clearSessions();
  const expiresAt = Date.now() + (remember ? REMEMBER_SESSION_MS : TAB_SESSION_MS);
  const record: StoredSession = { version: 1, accountId, expiresAt, remember };
  writeStorage(
    remember ? localStorage : sessionStorage,
    SESSION_STORAGE_KEY,
    JSON.stringify(record),
    'Oturum başlatılamadı. Tarayıcı depolamasını kontrol et.',
  );
  return { remember, expiresAt };
}

function validateRegistration(input: RegisterInput): void {
  const name = input.name.trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new Error('Ad 2–60 karakter olmalı.');
  }
  const email = normalizeEmail(input.email);
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new Error('Geçerli bir e-posta adresi gir.');
  }
  if (input.password.length < PASSWORD_MIN_LENGTH || input.password.length > PASSWORD_MAX_LENGTH) {
    throw new Error('Şifre 8–128 karakter olmalı.');
  }
}

export function getLocalAccount(): LocalAccount | null {
  const account = readAccount();
  return account ? toPublic(account) : null;
}

export function hasLocalAccount(): boolean {
  return readAccount() !== null;
}

export function getActiveSession(): AuthSession | null {
  const stored = readAccount();
  if (!stored) {
    clearSessions();
    return null;
  }
  const session = readSession(stored.id);
  if (!session) return null;
  return {
    account: toPublic(stored),
    session: { remember: session.remember, expiresAt: session.expiresAt },
  };
}

export async function registerLocalAccount(input: RegisterInput): Promise<AuthSession> {
  assertCrypto();
  validateRegistration(input);
  if (readAccount()) {
    throw new Error('Bu cihazda zaten bir yerel hesap var.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  let hash: Uint8Array;
  try {
    hash = await derivePassword(input.password, salt, PASSWORD_ITERATIONS);
  } catch {
    throw new Error('Tarayıcıda güvenli kriptografi kullanılamıyor.');
  }

  const now = Date.now();
  const account: StoredAccount = {
    id: createId(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    avatar: null,
    salt: toBase64(salt),
    hash: toBase64(hash),
    iterations: PASSWORD_ITERATIONS,
    color: '#3ef2b5',
    createdAt: now,
    lastLoginAt: now,
  };
  writeAccount(account);
  const session = createSession(account.id, input.remember);
  return { account: toPublic(account), session };
}

export async function loginLocalAccount(input: LoginInput): Promise<AuthSession> {
  assertCrypto();
  const stored = readAccount();
  if (!stored) {
    throw new Error('Bu cihazda kayıtlı yerel hesap yok.');
  }

  let derived: Uint8Array;
  try {
    derived = await derivePassword(input.password, fromBase64(stored.salt), stored.iterations);
  } catch {
    throw new Error('Tarayıcıda güvenli kriptografi kullanılamıyor.');
  }

  const passwordOk = equalBytes(derived, fromBase64(stored.hash));
  const emailOk = normalizeEmail(input.email) === normalizeEmail(stored.email);
  if (!emailOk || !passwordOk) {
    throw new Error('E-posta veya şifre hatalı.');
  }

  stored.lastLoginAt = Date.now();
  writeAccount(stored);
  const session = createSession(stored.id, input.remember);
  return { account: toPublic(stored), session };
}

export function logoutLocalAccount(): void {
  clearSessions();
}

export function updateLocalAccountAvatar(avatar: string | null): LocalAccount {
  const stored = readAccount();
  if (!stored) {
    throw new Error('Bu cihazda kayıtlı yerel hesap yok.');
  }
  if (avatar !== null && !normalizeAvatar(avatar)) {
    throw new Error('Görsel kaydedilemedi.');
  }
  stored.avatar = avatar === null ? null : normalizeAvatar(avatar);
  writeAccount(stored);
  return toPublic(stored);
}

export function resetLocalAccount(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    throw new Error(STORAGE_ERROR);
  }
  clearSessions();
}

export function hasGuestSession(): boolean {
  return readStorage(localStorage, GUEST_STORAGE_KEY) === '1';
}

export function startGuestSession(): void {
  writeStorage(localStorage, GUEST_STORAGE_KEY, '1', STORAGE_ERROR);
}

export function clearGuestSession(): void {
  removeStorage(localStorage, GUEST_STORAGE_KEY);
}

export function readGuestAvatar(): string | null {
  return normalizeAvatar(readStorage(localStorage, GUEST_AVATAR_KEY));
}

export function writeGuestAvatar(avatar: string | null): void {
  if (avatar === null) {
    removeStorage(localStorage, GUEST_AVATAR_KEY);
    return;
  }
  const safe = normalizeAvatar(avatar);
  if (!safe) throw new Error('Görsel kaydedilemedi.');
  writeStorage(localStorage, GUEST_AVATAR_KEY, safe, STORAGE_ERROR);
}

export function passwordStrength(value: string): number {
  if (!value) return 0;
  if (value.length < PASSWORD_MIN_LENGTH) return 1;
  let score = 1;
  if (value.length >= 12) score += 1;
  if (/\d/.test(value) && /[^\d\s]/.test(value)) score += 1;
  if (
    /[^A-Za-z0-9]/.test(value) ||
    (/[a-zçğıöşü]/.test(value) && /[A-ZÇĞİÖŞÜ]/.test(value))
  ) {
    score += 1;
  }
  return Math.min(4, score);
}

export function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EZ';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase('tr-TR');
}
