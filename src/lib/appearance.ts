import type { TranslationKey } from '../i18n/core';
import type { AppTheme } from '../types';

export const APP_THEMES: readonly {
  id: AppTheme;
  label: TranslationKey;
  accent: string;
  surface: string;
}[] = [
  { id: 'night', label: 'Gece', accent: '#3ef2b5', surface: '#050807' },
  { id: 'violet', label: 'Menekşe', accent: '#b69cff', surface: '#07060d' },
  { id: 'ice', label: 'Buz', accent: '#7dd3fc', surface: '#04090d' },
  { id: 'lime', label: 'Lime', accent: '#c6f56a', surface: '#070906' },
];

export const THEME_STORAGE_KEY = 'ezwin.theme';
export const MOTION_STORAGE_KEY = 'ezwin.reduceMotion';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function isAppTheme(value: unknown): value is AppTheme {
  return APP_THEMES.some((theme) => theme.id === value);
}

export function storedTheme(): AppTheme {
  const value = readStorage(THEME_STORAGE_KEY);
  return isAppTheme(value) ? value : 'night';
}

export function storedReduceMotion(): boolean {
  return readStorage(MOTION_STORAGE_KEY) === '1';
}

export function applyTheme(theme: AppTheme, persist = false): void {
  document.documentElement.dataset.theme = theme;
  if (!persist) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage can be unavailable; the saved setting still applies */
  }
}

export function applyReduceMotion(reduce: boolean, persist = false): void {
  document.documentElement.dataset.motion = reduce ? 'reduced' : 'full';
  if (!persist) return;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, reduce ? '1' : '0');
  } catch {
    /* storage can be unavailable; the saved setting still applies */
  }
}

export function applyFullscreen(fullscreen: boolean): void {
  document.documentElement.dataset.fullscreen = fullscreen ? 'true' : 'false';
}
