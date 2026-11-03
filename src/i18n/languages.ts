import type { LanguageCode } from '../types';

export interface LanguageMeta {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  locale: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', locale: 'tr-TR', dir: 'ltr' },
  { code: 'en', nativeName: 'English', englishName: 'English', locale: 'en-US', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', locale: 'de-DE', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', locale: 'es-ES', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', locale: 'fr-FR', dir: 'ltr' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', locale: 'pt-PT', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', locale: 'ru-RU', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', locale: 'ar-SA-u-nu-latn', dir: 'rtl' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese (Simplified)', locale: 'zh-CN', dir: 'ltr' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', locale: 'ja-JP', dir: 'ltr' },
];

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code) as LanguageCode[];

export function getLanguageMeta(code: LanguageCode): LanguageMeta {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

export function normalizeLanguage(value: unknown): LanguageCode {
  return LANGUAGE_CODES.includes(value as LanguageCode) ? (value as LanguageCode) : 'tr';
}
