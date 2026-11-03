export const TRANSLATE_LANGUAGE_CODES = [
  'tr',
  'en',
  'de',
  'es',
  'fr',
  'pt',
  'ru',
  'ar',
  'zh',
  'ja',
  'it',
  'nl',
  'pl',
  'uk',
  'bg',
  'cs',
  'da',
  'el',
  'fa',
  'fi',
  'hi',
  'hu',
  'id',
  'ko',
  'no',
  'ro',
  'sv',
] as const;

export type TranslateLanguageCode = (typeof TRANSLATE_LANGUAGE_CODES)[number];

const VALID = new Set<string>(TRANSLATE_LANGUAGE_CODES);
const API = 'https://api.mymemory.translated.net/get';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_LENGTH = 5000;
const CHUNK_LENGTH = 450;
const cache = new Map<string, { value: WebTranslateResult; expiresAt: number }>();

export interface WebTranslateResult {
  text: string;
  engine: string;
}

export function isTranslateLanguage(value: string): value is TranslateLanguageCode {
  return VALID.has(value);
}

function chunkLine(line: string, maxLength: number): string[] {
  if (line.length <= maxLength) return [line];
  const parts: string[] = [];
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

async function requestPiece(text: string, source: string, target: string): Promise<string> {
  const url = new URL(API);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `${source}|${target}`);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => ({}));
    const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const payload =
      record.responseData && typeof record.responseData === 'object'
        ? (record.responseData as Record<string, unknown>)
        : {};
    const translated = typeof payload.translatedText === 'string' ? payload.translatedText : '';
    if (!response.ok || Number(record.responseStatus) !== 200 || !translated) {
      const detail =
        typeof record.responseDetails === 'string' ? record.responseDetails : '';
      throw new Error(detail || 'Çeviri servisi yanıt vermedi.');
    }
    return translated;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function translateTextWeb(input: {
  text: string;
  source: string;
  target: string;
}): Promise<WebTranslateResult> {
  const clean = input.text.trim();
  if (!clean) throw new Error('Çevrilecek bir metin yaz.');
  if (clean.length > MAX_LENGTH) throw new Error('Metin 5000 karakteri aşamaz.');
  if (!isTranslateLanguage(input.source)) throw new Error('Kaynak dil geçersiz.');
  if (!isTranslateLanguage(input.target)) throw new Error('Hedef dil geçersiz.');
  if (input.source === input.target) return { text: clean, engine: 'Orbita' };

  const key = `${input.source}|${input.target}|${clean}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const output: string[] = [];
  for (const line of clean.split('\n')) {
    if (!line.trim()) {
      output.push('');
      continue;
    }
    const pieces: string[] = [];
    for (const piece of chunkLine(line, CHUNK_LENGTH)) {
      pieces.push(await requestPiece(piece, input.source, input.target));
    }
    output.push(pieces.join(' '));
  }

  const value: WebTranslateResult = { text: output.join('\n'), engine: 'MyMemory' };
  if (cache.size > 300) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
