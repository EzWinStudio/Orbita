import type { LanguageCode } from '../types';
import { en } from './en';
import { extraDictionaries } from './dictionaries';
import { getLanguageMeta, normalizeLanguage } from './languages';

export type TranslationKey = keyof typeof en;
export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type Dictionary = Partial<Record<TranslationKey, string>>;

const DICTIONARIES: Partial<Record<LanguageCode, Dictionary>> = {
  en,
  ...extraDictionaries,
};

let activeLanguage: LanguageCode = 'tr';

export function getGlobalLanguage(): LanguageCode {
  return activeLanguage;
}

export function getLocale(language: LanguageCode = activeLanguage): string {
  return getLanguageMeta(language).locale;
}

export function getDirection(language: LanguageCode = activeLanguage): 'ltr' | 'rtl' {
  return getLanguageMeta(language).dir;
}

export function setGlobalLanguage(language: LanguageCode): void {
  activeLanguage = normalizeLanguage(language);
  if (typeof document !== 'undefined') {
    const meta = getLanguageMeta(activeLanguage);
    document.documentElement.lang = meta.locale;
    document.documentElement.dir = meta.dir;
  }
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

export function translateFor(
  language: LanguageCode,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const normalized = normalizeLanguage(language);
  if (normalized === 'tr') return interpolate(key, vars);
  const template = DICTIONARIES[normalized]?.[key] ?? en[key] ?? key;
  return interpolate(template, vars);
}

export function tGlobal(key: TranslationKey, vars?: Record<string, string | number>): string {
  return translateFor(activeLanguage, key, vars);
}

export function registerDictionary(language: LanguageCode, dictionary: Dictionary): void {
  DICTIONARIES[language] = dictionary;
}

export function translateMessage(language: LanguageCode, message: string): string {
  const known = en[message as TranslationKey];
  if (!known) return message;
  return translateFor(language, message as TranslationKey);
}
