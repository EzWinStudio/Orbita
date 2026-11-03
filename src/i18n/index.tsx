import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { LanguageCode } from '../types';
import { getDirection, getLocale, setGlobalLanguage, translateFor, type TFunction } from './core';
import { LANGUAGES, normalizeLanguage, type LanguageMeta } from './languages';

interface I18nContextValue {
  language: LanguageCode;
  locale: string;
  dir: 'ltr' | 'rtl';
  languages: LanguageMeta[];
  t: TFunction;
  setLanguage: (language: LanguageCode) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  children: ReactNode;
}

export function I18nProvider({ language, onLanguageChange, children }: I18nProviderProps) {
  const normalized = normalizeLanguage(language);
  setGlobalLanguage(normalized);

  const t = useCallback<TFunction>(
    (key, vars) => translateFor(normalized, key, vars),
    [normalized],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language: normalized,
      locale: getLocale(normalized),
      dir: getDirection(normalized),
      languages: LANGUAGES,
      t,
      setLanguage: onLanguageChange,
    }),
    [normalized, t, onLanguageChange],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}

export { LANGUAGES, type LanguageMeta };
