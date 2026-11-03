'use strict';

const { safeStorage } = require('electron');

async function isAvailable() {
  try {
    if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
      return await safeStorage.isAsyncEncryptionAvailable();
    }
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encrypt(value) {
  try {
    return safeStorage.encryptString(value).toString('base64');
  } catch {
    throw new Error('Windows güvenli depolama (DPAPI) kullanılamıyor. Anahtar kaydedilemedi.');
  }
}

function decrypt(blob) {
  if (!blob) throw new Error('Kayıtlı anahtar bulunamadı.');
  return safeStorage.decryptString(Buffer.from(blob, 'base64'));
}

function makeHint(value) {
  const clean = String(value || '').trim();
  if (clean.length <= 4) return '••••';
  return `••••${clean.slice(-4)}`;
}

module.exports = { isAvailable, encrypt, decrypt, makeHint };
