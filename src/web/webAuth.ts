import {
  claimLegacyWorkspace,
  getWorkspaceScope,
  releaseLegacyWorkspace,
  setWorkspaceScope,
} from './workspaceScope';

export const AUTH_STORAGE_KEY = 'ezwin.hub.web.auth.v1';
export const ACCOUNTS_STORAGE_KEY = 'ezwin.hub.web.accounts.v1';
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
const ACCOUNT_BUNDLE_KIND = 'orbita-account';
const ACCOUNT_BUNDLE_VERSION = 1;

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

function normalizeAccountList(raw: unknown): StoredAccount[] {
  if (!isRecord(raw) || !Array.isArray(raw.accounts)) return [];
  const seen = new Set<string>();
  const accounts: StoredAccount[] = [];
  for (const entry of raw.accounts) {
    const account = normalizeStoredAccount(entry);
    if (!account) continue;
    const key = account.id || normalizeEmail(account.email);
    if (seen.has(key)) continue;
    seen.add(key);
    accounts.push(account);
  }
  return accounts;
}

function readAccounts(): StoredAccount[] {
  const raw = readStorage(localStorage, ACCOUNTS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isRecord(parsed) && Array.isArray(parsed.accounts)) {
        return normalizeAccountList(parsed);
      }
    } catch {
      /* fall back to the legacy single-account record */
    }
  }

  const legacy = readStorage(localStorage, AUTH_STORAGE_KEY);
  if (!legacy) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(legacy);
  } catch {
    return [];
  }
  const source = isRecord(parsed) && isRecord(parsed.account) ? parsed.account : parsed;
  const account = normalizeStoredAccount(source);
  if (!account) return [];
  try {
    writeAccounts([account]);
    claimLegacyWorkspace(account.id);
    if (getWorkspaceScope() === 'local') setWorkspaceScope(account.id);
    removeStorage(localStorage, AUTH_STORAGE_KEY);
  } catch {
    /* keep reading the legacy record if migration cannot be persisted */
  }
  return [account];
}

function writeAccounts(accounts: StoredAccount[]): void {
  writeStorage(
    localStorage,
    ACCOUNTS_STORAGE_KEY,
    JSON.stringify({ version: 1, accounts }),
    'Yerel hesaplar kaydedilemedi. Tarayıcı depolamasını kontrol et.',
  );
}

function sortAccounts(accounts: StoredAccount[]): StoredAccount[] {
  return [...accounts].sort(
    (a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0) || b.createdAt - a.createdAt,
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

export function getLocalAccounts(): LocalAccount[] {
  return sortAccounts(readAccounts()).map(toPublic);
}

export function getLocalAccount(): LocalAccount | null {
  const accounts = readAccounts();
  if (!accounts.length) return null;
  const scope = getWorkspaceScope();
  const scoped = accounts.find((account) => account.id === scope);
  return toPublic(scoped ?? sortAccounts(accounts)[0]);
}

export function hasLocalAccount(): boolean {
  return readAccounts().length > 0;
}

export function getActiveSession(): AuthSession | null {
  const accounts = readAccounts();
  if (!accounts.length) {
    clearSessions();
    return null;
  }
  const persistent = parseSession(readStorage(localStorage, SESSION_STORAGE_KEY));
  const tab = parseSession(readStorage(sessionStorage, SESSION_STORAGE_KEY));
  const candidate = persistent ?? tab;
  if (!candidate) return null;
  const stored = accounts.find((account) => account.id === candidate.accountId);
  if (!stored) {
    clearSessions();
    return null;
  }
  setWorkspaceScope(stored.id);
  return {
    account: toPublic(stored),
    session: { remember: candidate.remember, expiresAt: candidate.expiresAt },
  };
}

export async function registerLocalAccount(input: RegisterInput): Promise<AuthSession> {
  assertCrypto();
  validateRegistration(input);
  const accounts = readAccounts();
  const email = normalizeEmail(input.email);
  if (accounts.some((account) => normalizeEmail(account.email) === email)) {
    throw new Error('Bu e-posta ile kayıtlı bir hesap var. Giriş yapabilirsin.');
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
    email,
    avatar: null,
    salt: toBase64(salt),
    hash: toBase64(hash),
    iterations: PASSWORD_ITERATIONS,
    color: '#3ef2b5',
    createdAt: now,
    lastLoginAt: now,
  };
  writeAccounts([...accounts, account]);
  if (accounts.length === 0) claimLegacyWorkspace(account.id);
  const session = createSession(account.id, input.remember);
  setWorkspaceScope(account.id);
  return { account: toPublic(account), session };
}

export async function loginLocalAccount(input: LoginInput): Promise<AuthSession> {
  assertCrypto();
  const accounts = readAccounts();
  if (!accounts.length) {
    throw new Error('Bu cihazda kayıtlı hesap yok.');
  }

  const email = normalizeEmail(input.email);
  const stored = accounts.find((account) => normalizeEmail(account.email) === email);
  if (!stored) {
    throw new Error('E-posta veya şifre hatalı.');
  }

  let derived: Uint8Array;
  try {
    derived = await derivePassword(input.password, fromBase64(stored.salt), stored.iterations);
  } catch {
    throw new Error('Tarayıcıda güvenli kriptografi kullanılamıyor.');
  }

  if (!equalBytes(derived, fromBase64(stored.hash))) {
    throw new Error('E-posta veya şifre hatalı.');
  }

  stored.lastLoginAt = Date.now();
  writeAccounts(accounts);
  const session = createSession(stored.id, input.remember);
  setWorkspaceScope(stored.id);
  return { account: toPublic(stored), session };
}

export function logoutLocalAccount(): void {
  clearSessions();
}

export function updateLocalAccountAvatar(avatar: string | null): LocalAccount {
  const accounts = readAccounts();
  const scope = getWorkspaceScope();
  const stored = accounts.find((account) => account.id === scope);
  if (!stored) {
    throw new Error('Bu cihazda kayıtlı hesap yok.');
  }
  if (avatar !== null && !normalizeAvatar(avatar)) {
    throw new Error('Görsel kaydedilemedi.');
  }
  stored.avatar = avatar === null ? null : normalizeAvatar(avatar);
  writeAccounts(accounts);
  return toPublic(stored);
}

export function resetLocalAccount(email?: string): void {
  const accounts = readAccounts();
  const targetEmail = email ? normalizeEmail(email) : '';
  const scope = getWorkspaceScope();
  const target = targetEmail
    ? accounts.find((account) => normalizeEmail(account.email) === targetEmail)
    : accounts.find((account) => account.id === scope) ?? accounts[0];
  if (!target) {
    throw new Error(
      targetEmail ? 'Bu e-posta ile kayıtlı hesap yok.' : 'Bu cihazda kayıtlı hesap yok.',
    );
  }
  const remaining = accounts.filter((account) => account.id !== target.id);
  writeAccounts(remaining);
  if (remaining.length === 0) releaseLegacyWorkspace(target.id);
  clearSessions();
  setWorkspaceScope('local');
}

export interface AccountBundle {
  app: 'orbita';
  kind: 'orbita-account';
  version: number;
  exportedAt: string;
  account: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    salt: string;
    hash: string;
    iterations: number;
    color: string;
    createdAt: number;
  };
}

export function exportAccountBundle(): { fileName: string; text: string; account: LocalAccount } {
  const accounts = readAccounts();
  const scope = getWorkspaceScope();
  const stored = accounts.find((account) => account.id === scope) ?? sortAccounts(accounts)[0];
  if (!stored) {
    throw new Error('Bu cihazda kayıtlı hesap yok.');
  }
  const bundle: AccountBundle = {
    app: 'orbita',
    kind: ACCOUNT_BUNDLE_KIND,
    version: ACCOUNT_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      id: stored.id,
      name: stored.name,
      email: stored.email,
      avatar: stored.avatar,
      salt: stored.salt,
      hash: stored.hash,
      iterations: stored.iterations,
      color: stored.color,
      createdAt: stored.createdAt,
    },
  };
  const slug = stored.email.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'hesap';
  return {
    fileName: `orbita-hesap-${slug}.json`,
    text: JSON.stringify(bundle, null, 2),
    account: toPublic(stored),
  };
}

export function importAccountBundle(text: string): LocalAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Hesap dosyası okunamadı.');
  }
  if (
    !isRecord(parsed) ||
    parsed.kind !== ACCOUNT_BUNDLE_KIND ||
    typeof parsed.version !== 'number' ||
    parsed.version > ACCOUNT_BUNDLE_VERSION ||
    !isRecord(parsed.account)
  ) {
    throw new Error('Bu dosya geçerli bir Orbita hesap dosyası değil.');
  }
  const account = normalizeStoredAccount(parsed.account);
  if (!account) {
    throw new Error('Hesap dosyası geçersiz veya eksik.');
  }
  const accounts = readAccounts();
  const sameId = accounts.find((item) => item.id === account.id);
  if (sameId) {
    if (sameId.hash === account.hash && sameId.salt === account.salt) {
      return toPublic(sameId);
    }
    throw new Error('Bu hesap kimliği başka bir hesapla çakışıyor.');
  }
  const sameEmail = accounts.find(
    (item) => normalizeEmail(item.email) === normalizeEmail(account.email),
  );
  if (sameEmail) {
    if (sameEmail.hash === account.hash && sameEmail.salt === account.salt) {
      return toPublic(sameEmail);
    }
    throw new Error('Bu e-posta bu cihazda farklı bir hesapla kayıtlı.');
  }
  account.lastLoginAt = null;
  writeAccounts([...accounts, account]);
  return toPublic(account);
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
