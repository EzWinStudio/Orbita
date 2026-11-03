'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_STEPS_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000];
const SCRYPT_COST = 16384;
const MIN_PASSWORD_LENGTH = 10;
const MIN_NEW_PASSWORD_LENGTH = 10;

const COLORS = ['#3ef2b5', '#5fc6ff', '#b98bff', '#ffc857', '#ff8fd8', '#a8ff60', '#ff8a1e'];
const AUTO_LOCK_CHOICES = [0, 5, 15, 30, 60];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_MAX_ATTEMPTS = 5;
const BACKUP_CODE_COUNT = 10;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function defaultSecurity() {
  return { autoLockMinutes: 15, lockOnBlur: false, rememberDefault: true };
}

function defaultTwoFactor() {
  return {
    enabled: false,
    secret: null,
    pendingSecret: null,
    pendingCreatedAt: 0,
    backupCodes: [],
    enabledAt: null,
  };
}

function normalizeTwoFactor(value) {
  const base = defaultTwoFactor();
  if (!value || typeof value !== 'object') return base;
  return {
    enabled: Boolean(value.enabled),
    secret: typeof value.secret === 'string' ? value.secret : null,
    pendingSecret: typeof value.pendingSecret === 'string' ? value.pendingSecret : null,
    pendingCreatedAt: Number(value.pendingCreatedAt) || 0,
    backupCodes: Array.isArray(value.backupCodes)
      ? value.backupCodes.filter((code) => typeof code === 'string')
      : [],
    enabledAt: Number(value.enabledAt) || null,
  };
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpCode(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    (((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) %
    10 ** TOTP_DIGITS;
  return String(value).padStart(TOTP_DIGITS, '0');
}

function verifyTotp(secret, code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(clean) || !secret) return false;
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    if (totpCode(secret, counter + offset) === clean) return true;
  }
  return false;
}

function backupCodeHash(code) {
  return crypto
    .createHash('sha256')
    .update(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .digest('hex');
}

function createBackupCodes() {
  const plain = [];
  const hashes = [];
  for (let index = 0; index < BACKUP_CODE_COUNT; index += 1) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    plain.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
    hashes.push(backupCodeHash(raw));
  }
  return { plain, hashes };
}

function consumeBackupCode(account, code) {
  const normalized = String(code || '').replace(/[^A-Za-z0-9]/g, '');
  if (normalized.length !== 8) return false;
  const hash = backupCodeHash(normalized);
  const list = account.twoFactor?.backupCodes || [];
  const index = list.indexOf(hash);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}

function otpauthUrl(account, secret) {
  const label = `EZWIN HUB:${account.email}`;
  const params = new URLSearchParams({
    secret,
    issuer: 'EZWIN HUB',
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function passwordScore(password) {
  const value = String(password || '');
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-zçğıöşü]/i.test(value) && /[A-ZÇĞİÖŞÜ]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length >= 16) score += 1;
  return Math.min(5, score);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: SCRYPT_COST, r: 8, p: 1 });
  return `scrypt$${SCRYPT_COST}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[2], 'base64url');
    const expected = Buffer.from(parts[3], 'base64url');
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: Number(parts[1]) || SCRYPT_COST,
      r: 8,
      p: 1,
    });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function securityScore(account) {
  const security = { ...defaultSecurity(), ...(account.security || {}) };
  let score = 20 + (Number(account.passwordScore) || 0) * 8;
  if (security.autoLockMinutes > 0) score += 12;
  if (security.autoLockMinutes > 0 && security.autoLockMinutes <= 15) score += 6;
  if (security.lockOnBlur) score += 6;
  if (security.rememberDefault) score += 4;
  if (account.twoFactor?.enabled) score += 12;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function publicAccount(account) {
  const twoFactor = normalizeTwoFactor(account.twoFactor);
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    color: account.color,
    avatar: account.avatar ?? null,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt ?? null,
    passwordChangedAt: account.passwordChangedAt ?? null,
    hasPassword: Boolean(account.passwordHash),
    passwordScore: Number(account.passwordScore) || 0,
    security: { ...defaultSecurity(), ...(account.security || {}) },
    securityScore: securityScore(account),
    twoFactorEnabled: Boolean(twoFactor.enabled && twoFactor.secret),
    twoFactorEnabledAt: twoFactor.enabledAt,
    backupCodesRemaining: twoFactor.backupCodes.length,
  };
}

function cleanAvatar(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if ([...text].length > 4) throw new Error('Avatar en fazla 4 emoji olabilir.');
  if (/[\u0000-\u001f<>]/.test(text)) throw new Error('Avatar geçersiz karakter içeriyor.');
  return text;
}

function cleanColor(value) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error('Renk #RRGGBB biçiminde olmalı.');
  }
  return value.toLowerCase();
}

/**
 * Local account registry. Every account gets its own profile directory so one
 * person's hub data never mixes with another's. The password itself is only
 * ever stored as a salted scrypt hash; the "remember me" choice only decides
 * whether the session file survives a restart.
 */
class Accounts {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.file = path.join(baseDir, 'accounts.json');
    this.sessionFile = path.join(baseDir, 'session.json');
    this.profilesDir = path.join(baseDir, 'profiles');
    fs.mkdirSync(this.profilesDir, { recursive: true });
    this.state = this.load();
    this.memorySession = null;
    this.failures = new Map();
    this.challenges = new Map();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
      return {
        version: 1,
        accounts: accounts
          .filter(
            (account) =>
              account &&
              typeof account.id === 'string' &&
              typeof account.email === 'string' &&
              typeof account.passwordHash === 'string',
          )
          .map((account) => ({
            ...account,
            avatar: account.avatar ?? null,
            security: { ...defaultSecurity(), ...(account.security || {}) },
            twoFactor: normalizeTwoFactor(account.twoFactor),
            passwordScore: Number(account.passwordScore) || 0,
            failedAttempts: Number(account.failedAttempts) || 0,
            lockouts: Number(account.lockouts) || 0,
            lockedUntil: Number(account.lockedUntil) || 0,
            passwordChangedAt: Number(account.passwordChangedAt) || null,
          })),
      };
    } catch {
      return { version: 1, accounts: [] };
    }
  }

  save() {
    try {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[accounts] yazılamadı:', err.message);
    }
  }

  list() {
    return this.state.accounts.map(publicAccount);
  }

  count() {
    return this.state.accounts.length;
  }

  profileDir(accountId) {
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(accountId)) throw new Error('Hesap kimliği geçersiz.');
    return path.join(this.profilesDir, accountId);
  }

  findByEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    return this.state.accounts.find((account) => account.email === clean) || null;
  }

  byId(id) {
    return this.state.accounts.find((account) => account.id === id) || null;
  }

  lockSecondsLeft(account) {
    if (!account || !account.lockedUntil) return 0;
    return Math.max(0, Math.ceil((account.lockedUntil - Date.now()) / 1000));
  }

  assertNotLocked(account) {
    const seconds = this.lockSecondsLeft(account);
    if (seconds > 0) {
      throw new Error(
        `Çok fazla hatalı deneme. ${Math.ceil(seconds / 60)} dakika sonra tekrar dene.`,
      );
    }
  }

  registerFailure(account) {
    if (!account) return;
    account.failedAttempts = (Number(account.failedAttempts) || 0) + 1;
    if (account.failedAttempts >= MAX_ATTEMPTS) {
      const step = Math.min(Number(account.lockouts) || 0, LOCK_STEPS_MS.length - 1);
      account.lockedUntil = Date.now() + LOCK_STEPS_MS[step];
      account.lockouts = (Number(account.lockouts) || 0) + 1;
      account.failedAttempts = 0;
    }
    this.save();
  }

  clearFailures(account) {
    if (!account) return;
    account.failedAttempts = 0;
    account.lockouts = 0;
    account.lockedUntil = 0;
    this.save();
  }

  /** First account inherits any state written before accounts existed. */
  migrateLegacyState(accountId) {
    const legacyFile = path.join(this.baseDir, 'app-state.json');
    const targetDir = this.profileDir(accountId);
    const targetFile = path.join(targetDir, 'app-state.json');
    fs.mkdirSync(targetDir, { recursive: true });
    if (!fs.existsSync(legacyFile) || fs.existsSync(targetFile)) return false;
    try {
      fs.copyFileSync(legacyFile, targetFile);
      return true;
    } catch (err) {
      console.error('[accounts] eski veri taşınamadı:', err.message);
      return false;
    }
  }

  register({ email, password, name, remember = true }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const cleanName = String(name || '').trim() || cleanEmail.split('@')[0] || 'EzWin';

    if (!EMAIL_RE.test(cleanEmail)) throw new Error('Geçerli bir e-posta adresi gir.');
    if (cleanEmail.length > 254) throw new Error('E-posta adresi çok uzun.');
    if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error('Şifre en az 10 karakter olmalı.');
    }
    if (cleanPassword.length > 200) throw new Error('Şifre en fazla 200 karakter olabilir.');
    if (cleanName.length > 60) throw new Error('Ad en fazla 60 karakter olabilir.');
    if (this.findByEmail(cleanEmail)) {
      throw new Error('Bu e-posta ile bir hesap zaten var. Giriş yap.');
    }

    const isFirst = this.state.accounts.length === 0;
    const security = defaultSecurity();
    security.rememberDefault = remember !== false;
    const account = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      name: cleanName,
      passwordHash: hashPassword(cleanPassword),
      color: COLORS[this.state.accounts.length % COLORS.length],
      avatar: null,
      createdAt: Date.now(),
      lastLoginAt: null,
      passwordChangedAt: Date.now(),
      passwordScore: passwordScore(cleanPassword),
      security,
      twoFactor: defaultTwoFactor(),
      failedAttempts: 0,
      lockouts: 0,
      lockedUntil: 0,
    };

    this.state.accounts.push(account);
    this.save();
    fs.mkdirSync(this.profileDir(account.id), { recursive: true });
    if (isFirst) this.migrateLegacyState(account.id);
    this.startSession(account.id, { remember });
    return publicAccount(this.byId(account.id));
  }

  login({ email, password, remember = true }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const account = this.findByEmail(cleanEmail);

    if (account) this.assertNotLocked(account);

    if (!account || !verifyPassword(String(password || ''), account.passwordHash)) {
      if (account) this.registerFailure(account);
      throw new Error('E-posta veya şifre hatalı.');
    }

    this.clearFailures(account);

    // İki adımlı doğrulama açıksa oturum henüz başlamaz; kısa ömürlü bir
    // meydan okuma kimliği döner ve kod doğrulanınca oturum açılır.
    if (account.twoFactor?.enabled && account.twoFactor.secret) {
      const challengeId = crypto.randomBytes(24).toString('base64url');
      this.challenges.set(challengeId, {
        accountId: account.id,
        remember: remember !== false,
        createdAt: Date.now(),
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
        attempts: 0,
      });
      return {
        requires2fa: true,
        challengeId,
        email: account.email,
        name: account.name,
        expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
      };
    }

    account.lastLoginAt = Date.now();
    this.save();
    this.startSession(account.id, { remember });
    return publicAccount(account);
  }

  verifyTwoFactor({ challengeId, code } = {}) {
    const challenge = this.challenges.get(String(challengeId || ''));
    if (!challenge) {
      throw new Error('Doğrulama isteği bulunamadı. Girişi baştan dene.');
    }
    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(String(challengeId));
      throw new Error('Doğrulama süresi doldu. Girişi baştan dene.');
    }

    const account = this.byId(challenge.accountId);
    if (!account || !account.twoFactor?.enabled) {
      this.challenges.delete(String(challengeId));
      throw new Error('Hesap bulunamadı ya da doğrulama kapalı.');
    }

    const clean = String(code || '').trim();
    if (!clean) throw new Error('Doğrulama kodunu gir.');

    challenge.attempts += 1;
    const valid =
      verifyTotp(account.twoFactor.secret, clean) || consumeBackupCode(account, clean);

    if (!valid) {
      if (challenge.attempts >= CHALLENGE_MAX_ATTEMPTS) {
        this.challenges.delete(String(challengeId));
        this.registerFailure(account);
        throw new Error('Çok fazla hatalı kod. Girişi baştan dene.');
      }
      throw new Error(
        `Kod hatalı. ${CHALLENGE_MAX_ATTEMPTS - challenge.attempts} deneme hakkın kaldı.`,
      );
    }

    this.challenges.delete(String(challengeId));
    this.clearFailures(account);
    account.lastLoginAt = Date.now();
    this.save();
    this.startSession(account.id, { remember: challenge.remember });
    return publicAccount(account);
  }

  beginTwoFactor(accountId) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');
    if (account.twoFactor?.enabled) throw new Error('İki adımlı doğrulama zaten açık.');

    const secret = base32Encode(crypto.randomBytes(20));
    account.twoFactor = {
      ...normalizeTwoFactor(account.twoFactor),
      enabled: false,
      secret: null,
      pendingSecret: secret,
      pendingCreatedAt: Date.now(),
      backupCodes: [],
      enabledAt: null,
    };
    this.save();

    return {
      secret,
      otpauthUrl: otpauthUrl(account, secret),
      account: publicAccount(account),
    };
  }

  enableTwoFactor(accountId, { code } = {}) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');
    if (account.twoFactor?.enabled) throw new Error('İki adımlı doğrulama zaten açık.');

    const pending = account.twoFactor?.pendingSecret;
    if (!pending) throw new Error('Önce kurulumu başlat.');
    if (Date.now() - (account.twoFactor.pendingCreatedAt || 0) > 15 * 60 * 1000) {
      throw new Error('Kurulum süresi doldu. Yeniden başlat.');
    }
    if (!verifyTotp(pending, code)) throw new Error('Kod hatalı. Uygulamadaki 6 haneli kodu gir.');

    const { plain, hashes } = createBackupCodes();
    account.twoFactor = {
      enabled: true,
      secret: pending,
      pendingSecret: null,
      pendingCreatedAt: 0,
      backupCodes: hashes,
      enabledAt: Date.now(),
    };
    this.save();

    return { account: publicAccount(account), backupCodes: plain };
  }

  disableTwoFactor(accountId, { password, code } = {}) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');
    if (!account.twoFactor?.enabled) throw new Error('İki adımlı doğrulama zaten kapalı.');
    this.assertNotLocked(account);

    if (!verifyPassword(String(password || ''), account.passwordHash)) {
      this.registerFailure(account);
      throw new Error('Şifre hatalı.');
    }
    const valid =
      verifyTotp(account.twoFactor.secret, code) || consumeBackupCode(account, code);
    if (!valid) throw new Error('Doğrulama kodu hatalı.');

    account.twoFactor = defaultTwoFactor();
    this.clearFailures(account);
    this.save();
    return publicAccount(account);
  }

  regenerateBackupCodes(accountId, { password, code } = {}) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');
    if (!account.twoFactor?.enabled) throw new Error('İki adımlı doğrulama açık değil.');
    this.assertNotLocked(account);

    if (!verifyPassword(String(password || ''), account.passwordHash)) {
      this.registerFailure(account);
      throw new Error('Şifre hatalı.');
    }
    const valid =
      verifyTotp(account.twoFactor.secret, code) || consumeBackupCode(account, code);
    if (!valid) throw new Error('Doğrulama kodu hatalı.');

    const { plain, hashes } = createBackupCodes();
    account.twoFactor.backupCodes = hashes;
    this.clearFailures(account);
    this.save();
    return { account: publicAccount(account), backupCodes: plain };
  }

  updateProfile(accountId, payload = {}) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');

    if (payload.name !== undefined) {
      const name = String(payload.name || '').trim();
      if (!name) throw new Error('Ad boş olamaz.');
      if (name.length > 60) throw new Error('Ad en fazla 60 karakter olabilir.');
      account.name = name;
    }
    if (payload.color !== undefined) account.color = cleanColor(payload.color);
    if (payload.avatar !== undefined) account.avatar = cleanAvatar(payload.avatar);

    this.save();
    return publicAccount(account);
  }

  changePassword(accountId, { currentPassword, nextPassword } = {}) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');
    this.assertNotLocked(account);

    if (!verifyPassword(String(currentPassword || ''), account.passwordHash)) {
      this.registerFailure(account);
      throw new Error('Mevcut şifre hatalı.');
    }

    const next = String(nextPassword || '');
    if (next.length < MIN_NEW_PASSWORD_LENGTH) {
      throw new Error('Yeni şifre en az 10 karakter olmalı.');
    }
    if (next.length > 200) throw new Error('Şifre en fazla 200 karakter olabilir.');
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(next) || !/\d/.test(next)) {
      throw new Error('Yeni şifre en az bir harf ve bir rakam içermeli.');
    }
    if (verifyPassword(next, account.passwordHash)) {
      throw new Error('Yeni şifre eskisiyle aynı olamaz.');
    }

    account.passwordHash = hashPassword(next);
    account.passwordScore = passwordScore(next);
    account.passwordChangedAt = Date.now();
    this.clearFailures(account);
    return publicAccount(account);
  }

  updateSecurity(accountId, payload = {}) {
    const account = this.byId(accountId);
    if (!account) throw new Error('Hesap bulunamadı.');
    const security = { ...defaultSecurity(), ...(account.security || {}) };

    if (payload.autoLockMinutes !== undefined) {
      const minutes = Number(payload.autoLockMinutes);
      if (!AUTO_LOCK_CHOICES.includes(minutes)) {
        throw new Error('Otomatik kilit süresi geçersiz.');
      }
      security.autoLockMinutes = minutes;
    }
    if (payload.lockOnBlur !== undefined) security.lockOnBlur = Boolean(payload.lockOnBlur);
    if (payload.rememberDefault !== undefined) {
      security.rememberDefault = Boolean(payload.rememberDefault);
    }

    account.security = security;
    this.save();
    return publicAccount(account);
  }

  startSession(accountId, options = {}) {
    const remember = options.remember !== false;
    const session = {
      accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
      remember,
    };
    this.memorySession = session;
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
      if (remember) {
        fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2), 'utf8');
      } else {
        fs.rmSync(this.sessionFile, { force: true });
      }
    } catch (err) {
      console.error('[accounts] oturum yazılamadı:', err.message);
    }
    return session;
  }

  readSession() {
    try {
      const session = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
      if (!session || typeof session.accountId !== 'string') return null;
      if (session.remember === false) return null;
      if (Number(session.expiresAt) < Date.now()) return null;
      const account = this.byId(session.accountId);
      if (!account) return null;
      return publicAccount(account);
    } catch {
      return null;
    }
  }

  /** Signed-in account that survives an app restart, until it is locked. */
  resume() {
    return this.readSession();
  }

  lock() {
    this.memorySession = null;
    try {
      fs.rmSync(this.sessionFile, { force: true });
    } catch {
      /* already gone */
    }
  }
}

module.exports = {
  Accounts,
  publicAccount,
  passwordScore,
  defaultSecurity,
  defaultTwoFactor,
  normalizeTwoFactor,
  totpCode,
  verifyTotp,
};
