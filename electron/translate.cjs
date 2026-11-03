'use strict';

const LANGUAGES = [
  { code: 'auto', name: 'Otomatik algıla' },
  { code: 'ar', name: 'Arapça' },
  { code: 'bg', name: 'Bulgarca' },
  { code: 'cs', name: 'Çekçe' },
  { code: 'da', name: 'Danca' },
  { code: 'de', name: 'Almanca' },
  { code: 'el', name: 'Yunanca' },
  { code: 'en', name: 'İngilizce' },
  { code: 'es', name: 'İspanyolca' },
  { code: 'fa', name: 'Farsça' },
  { code: 'fi', name: 'Fince' },
  { code: 'fr', name: 'Fransızca' },
  { code: 'hi', name: 'Hintçe' },
  { code: 'hu', name: 'Macarca' },
  { code: 'id', name: 'Endonezce' },
  { code: 'it', name: 'İtalyanca' },
  { code: 'ja', name: 'Japonca' },
  { code: 'ko', name: 'Korece' },
  { code: 'nl', name: 'Felemenkçe' },
  { code: 'no', name: 'Norveççe' },
  { code: 'pl', name: 'Lehçe' },
  { code: 'pt', name: 'Portekizce' },
  { code: 'ro', name: 'Romence' },
  { code: 'ru', name: 'Rusça' },
  { code: 'sv', name: 'İsveççe' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'uk', name: 'Ukraynaca' },
  { code: 'zh', name: 'Çince' },
];

const CODES = new Set(LANGUAGES.map((language) => language.code));
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

/**
 * DeepL anahtarı: ortam değişkeni varsa o kullanılır, yoksa uygulamayla gelen
 * varsayılan anahtar devreye girer. ":fx" ile biten anahtarlar ücretsiz uç
 * noktayı kullanır.
 */
const DEFAULT_DEEPL_KEY = 'cf7b9f1c-a18a-4759-bf1a-88f49aa08116:fx';

function deeplKey() {
  const fromEnv = String(process.env.EZWIN_DEEPL_KEY || '').trim();
  return fromEnv || DEFAULT_DEEPL_KEY;
}

function isLanguage(code) {
  return typeof code === 'string' && CODES.has(code);
}

function chunkLine(line, maxLength) {
  if (line.length <= maxLength) return [line];
  const parts = [];
  let rest = line;
  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength);
    const cut = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf(', '),
      window.lastIndexOf(' '),
    );
    const index = cut > maxLength * 0.4 ? cut + 1 : maxLength;
    parts.push(rest.slice(0, index).trim());
    rest = rest.slice(index).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function translateWithMyMemory(text, source, target) {
  const lines = text.split('\n');
  const output = [];
  for (const line of lines) {
    if (!line.trim()) {
      output.push('');
      continue;
    }
    const pieces = [];
    for (const piece of chunkLine(line, 450)) {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', piece);
      url.searchParams.set('langpair', `${source}|${target}`);
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => ({}));
      const translated = data?.responseData?.translatedText;
      if (!response.ok || Number(data?.responseStatus) !== 200 || !translated) {
        throw new Error(data?.responseDetails || `Çeviri servisi ${response.status} döndü.`);
      }
      pieces.push(translated);
    }
    output.push(pieces.join(' '));
  }
  return { text: output.join('\n'), engine: 'MyMemory' };
}

async function translateWithDeepL(text, source, target) {
  const key = deeplKey();
  if (!key) throw new Error('DeepL anahtarı yok.');
  const endpoint = key.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  const body = new URLSearchParams({ text, target_lang: target.toUpperCase() });
  if (source !== 'auto') body.set('source_lang', source.toUpperCase());
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `DeepL-Auth-Key ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `DeepL ${response.status} döndü.`);
  const translated = data?.translations?.[0]?.text;
  if (!translated) throw new Error('DeepL boş çeviri döndürdü.');
  return { text: translated, engine: 'DeepL' };
}

async function translate({ text, source, target }) {
  const clean = String(text || '');
  const from = String(source || 'en');
  const to = String(target || 'tr');

  if (!clean.trim()) throw new Error('Çevrilecek bir metin yaz.');
  if (clean.length > 5000) throw new Error('Metin 5000 karakteri aşamaz.');
  if (!isLanguage(from)) throw new Error('Kaynak dil geçersiz.');
  if (!isLanguage(to) || to === 'auto') throw new Error('Hedef dil geçersiz.');
  if (from === to) return { text: clean, engine: 'yok' };

  const key = `${from}|${to}|${clean}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const attempts = [];
  if (deeplKey()) attempts.push(() => translateWithDeepL(clean, from, to));
  if (from !== 'auto') attempts.push(() => translateWithMyMemory(clean, from, to));

  if (attempts.length === 0) {
    throw new Error('Otomatik dil algılama için DeepL anahtarı gerekli; kaynak dili seçerek tekrar dene.');
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      const value = await attempt();
      if (cache.size > 300) cache.clear();
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(errors[0] || 'Çeviri başarısız.');
}

module.exports = { LANGUAGES, translate };
