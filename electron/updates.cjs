'use strict';

const path = require('node:path');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const crypto = require('node:crypto');
const { once } = require('node:events');

const DEFAULT_FEED_URL =
  'https://github.com/EzWinStudio/ezwin-hub/releases/latest/download/updates.json';

/**
 * Sürüm notları uygulamanın içinde tutulur; güncelleme kontrolü ise
 * yayınlanan bir JSON bildirim dosyasına bakar. Böylece uygulama mağazaya
 * bağlı olmadan da yeni sürümü fark eder.
 *
 * Beklenen bildirim biçimi:
 * { "version": "2.0.0", "url": "https://.../EZWIN-HUB-Setup-2.0.0.exe",
 *   "notes": ["...", "..."], "publishedAt": "2026-11-01T12:00:00Z" }
 */

const CHANGELOG = [
  {
    version: '2.6.6',
    date: '2026-11-06',
    title: 'Giriş ekranı avatar düzeltmesi',
    summary: 'Yüklenen geniş profil görselleri hesap kartının üzerine binmiyor.',
    items: [
      'Hesap seçicideki avatar 30 px yuvarlak alana kırpılır ve görsel taşması engellenir.',
    ],
  },
  {
    version: '2.6.5',
    date: '2026-11-06',
    title: 'Masaüstü ve Android için otomatik güncelleme',
    summary: 'Yeni sürümler GitHub üzerinden kendiliğinden indirilir, doğrulanır ve kurulur.',
    items: [
      'Masaüstü uygulaması yeni sürümü arka planda indirir ve SHA-256 ile doğrular; uygulamadan tek tıkla kurulur.',
      'Uygulama kapanırken indirilmiş güncelleme varsa kurulum kendiliğinden başlar.',
      'Android uygulaması yeni APK sürümünü denetler, indirir ve doğrulanmış paketi kurulum ekranına verir.',
      'Eşitleme kodu ve çeviri sonucu artık masaüstü uygulamasında da güvenilir şekilde kopyalanır.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-11-02',
    title: 'Çoklu YouTube anahtarları ve otomatik güncelleme',
    summary: 'Her kanal için ayrı anahtar, doğrulanmış güncelleme indirmesi ve tek tıkla kurulum.',
    items: [
      'Birden fazla YouTube Data API anahtarı ekle; kanalları anahtarlara paylaştır.',
      'Eski tek anahtar ilk açılışta otomatik olarak yeni anahtar listesine taşınır.',
      'Güncelleme paketi SHA-256 ile doğrulanır; kurulum yalnızca doğrulanmış dosyayla başlar.',
      'GitHub Releases güncelleme kanalı varsayılan olarak tanımlı.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-11-01',
    title: 'Hesap özelleştirme, güvenlik ve asistan',
    summary: 'Profilini özelleştir, oturumunu yönet, DeepL ile çevir ve yeni asistana soru sor.',
    items: [
      'Hesap sayfası: avatar, renk ve görünen ad özelleştirmesi.',
      'Güvenlik: otomatik kilit, odak kaybında kilitleme, kademeli hatalı giriş kilidi ve güvenlik puanı.',
      'Şifre değiştirme: güç göstergesi, en az 10 karakter ve harf + rakam zorunluluğu.',
      '“Beni hatırla”: kapalıyken uygulama kapanınca oturum sona erer.',
      'YouTube, Instagram ve TikTok için adım adım jeton rehberi ve örnek biçim.',
      'Aktif çeviri DeepL üzerinden çalışıyor; otomatik dil algılama destekleniyor.',
      'EZWIN Asistan: özet, görev/şirket/not/finans ekleme, çeviri, güncelleme denetimi ve genel sorular.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-11-01',
    title: 'Hesaplar, çoklu kanal ve stüdyo araçları',
    summary: 'Uygulama artık hesaplarla açılıyor; kanallar, müzik, çeviri ve güncellemeler tek yerde.',
    items: [
      'Zorunlu hesap sistemi: her hesabın kendi verisi ayrı klasörde tutulur ve şifreler scrypt ile saklanır.',
      'Sınırsız YouTube hesabı ekleyebilirsin — yeni hesap eskisinin jetonunu ezmez.',
      'Instagram ve TikTok bağlantıları aynı yerden yönetilir, jetonlar DPAPI ile şifrelenir.',
      'Müzik çalar: kendi ses dosyalarını içe aktar, çal, sırada ilerle.',
      'Aktif çeviri: yazarken anlık çeviri, dil çifti seçimi ve geçmiş.',
      'Güncelleme notları ve otomatik güncelleme kontrolü.',
    ],
  },
  {
    version: '1.8.4',
    date: '2026-11-01',
    title: 'Kararlı sürüm',
    summary: 'YouTube izleme, posta ve finans modüllerindeki son düzeltmeler.',
    items: [],
  },
];

function compareVersions(a, b) {
  const pa = String(a || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
  const pb = String(b || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let index = 0; index < length; index += 1) {
    const left = pa[index] ?? 0;
    const right = pb[index] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function latestNotes(currentVersion) {
  const newer = CHANGELOG.filter((entry) => compareVersions(entry.version, currentVersion) > 0);
  return newer.length > 0 ? newer : CHANGELOG;
}

function remoteUrl(value, field) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error(`${field} geçerli bir URL değil.`);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
    throw new Error(`${field} https:// olmalı.`);
  }
  return parsed;
}

async function checkFeed(feedUrl, currentVersion) {
  const url = String(feedUrl || '').trim() || DEFAULT_FEED_URL;
  const parsed = remoteUrl(url, 'Güncelleme adresi');

  const response = await fetch(parsed, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Güncelleme sunucusu ${response.status} döndü.`);
  }

  const data = await response.json();
  const latest = String(data.version || '').trim();
  if (!latest) throw new Error('Güncelleme dosyasında sürüm bilgisi yok.');

  const available = compareVersions(latest, currentVersion) > 0;
  const sha256 = typeof data.sha256 === 'string' ? data.sha256.trim().toLowerCase() : null;
  return {
    configured: true,
    available,
    currentVersion,
    latest,
    url: typeof data.url === 'string' ? data.url : null,
    sha256: /^[a-f0-9]{64}$/.test(sha256 || '') ? sha256 : null,
    notes: Array.isArray(data.notes) ? data.notes.map(String).slice(0, 20) : [],
    publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : null,
    checkedAt: Date.now(),
    message: available
      ? `Yeni sürüm hazır: v${latest}`
      : 'En güncel sürümü kullanıyorsun.',
  };
}

async function downloadInstaller({ downloadDir, url, version, sha256 }) {
  const target = remoteUrl(url, 'İndirme adresi');
  if (path.extname(target.pathname).toLowerCase() !== '.exe') {
    throw new Error('Güncelleme paketi bir .exe kurulum dosyası olmalı.');
  }
  const expected = String(sha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('Güncelleme bildiriminde geçerli bir SHA-256 doğrulaması yok.');
  }
  if (!downloadDir) throw new Error('İndirme klasörü belirtilmedi.');

  const dir = path.resolve(String(downloadDir));
  await fsPromises.mkdir(dir, { recursive: true });
  const safeVersion =
    String(version || 'new')
      .replace(/[^0-9A-Za-z._-]/g, '-')
      .slice(0, 40) || 'new';
  const file = path.join(dir, `EZWIN-HUB-Setup-${safeVersion}.exe`);
  const temp = `${file}.part`;
  fs.rmSync(temp, { force: true });

  const response = await fetch(target, {
    signal: AbortSignal.timeout(10 * 60 * 1000),
    redirect: 'follow',
  });
  if (!response.ok || !response.body) {
    throw new Error(`İndirme başarısız: ${response.status}`);
  }
  remoteUrl(response.url || target.href, 'İndirme adresi');

  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(temp);
  out.on('error', () => {});
  let total = 0;
  try {
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > 300 * 1024 * 1024) {
        throw new Error('Güncelleme paketi beklenenden büyük.');
      }
      hash.update(buffer);
      if (!out.write(buffer)) await once(out, 'drain');
    }
    out.end();
    await once(out, 'finish');
    const digest = hash.digest('hex');
    if (digest !== expected) {
      throw new Error('İndirilen güncelleme doğrulanamadı (SHA-256 uyuşmuyor).');
    }
    fs.renameSync(temp, file);
    return { file, size: fs.statSync(file).size, sha256: digest };
  } catch (err) {
    out.destroy();
    fs.rmSync(temp, { force: true });
    throw err;
  }
}

module.exports = {
  CHANGELOG,
  compareVersions,
  latestNotes,
  checkFeed,
  downloadInstaller,
  DEFAULT_FEED_URL,
};
