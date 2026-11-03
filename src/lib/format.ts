import type { ClockFormat, Currency, HistoryPoint } from '../types';
import { getLocale, tGlobal } from '../i18n/core';

export function formatMoney(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString(getLocale(), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatClock(
  ts: number,
  format: ClockFormat = '24h',
  showSeconds = false,
): string {
  return new Date(ts).toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
    hour12: format === '12h',
  });
}

export function formatLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return '—';
  if (diff < 8000) return tGlobal('az önce');
  const relative = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return relative.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 30) return relative.format(-days, 'day');
  return formatDateTime(ts);
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

export function monthKeyOf(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString(getLocale(), {
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' } : {}),
  });
  return label;
}

export function lastMonths(count: number, endKey = currentMonthKey()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(shiftMonthKey(endKey, -i));
  }
  return keys;
}

export function isSameMonth(dateISO: string, key: string): boolean {
  return monthKeyOf(dateISO) === key;
}

export function dueLabel(due: string | null): { text: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } | null {
  if (!due) return null;
  const today = todayISO();
  if (due < today) {
    const diff = Math.round(
      (new Date(`${today}T00:00:00`).getTime() - new Date(`${due}T00:00:00`).getTime()) / 86400000,
    );
    return { text: tGlobal('Gecikme: {days} gün', { days: diff }), tone: 'overdue' };
  }
  if (due === today) return { text: tGlobal('Bugün'), tone: 'today' };
  const diff = Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
  );
  if (diff === 1) return { text: tGlobal('Yarın'), tone: 'soon' };
  if (diff <= 7) return { text: tGlobal('Kalan: {days} gün', { days: diff }), tone: 'soon' };
  return { text: formatDate(due), tone: 'normal' };
}

export function successRate(history: HistoryPoint[]): number | null {
  if (!history.length) return null;
  const ok = history.filter((point) => point.ok).length;
  return Math.round((ok / history.length) * 100);
}

export function sslInfo(expiresAt: number | null): { text: string; tone: 'ok' | 'warn' | 'bad' } | null {
  if (!expiresAt) return null;
  const days = Math.ceil((expiresAt - Date.now()) / 86400000);
  if (days < 0) return { text: tGlobal('Süresi doldu'), tone: 'bad' };
  if (days <= 14) return { text: tGlobal('Kalan: {days} gün', { days }), tone: 'warn' };
  return { text: tGlobal('Kalan: {days} gün', { days }), tone: 'ok' };
}

export function durationShort(ms: number | null): string {
  if (!ms || ms < 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const DurationFormat = (Intl as unknown as { DurationFormat?: new (locale: string, options?: object) => { format: (duration: object) => string } }).DurationFormat;
  if (DurationFormat) {
    return new DurationFormat(getLocale(), { style: 'short' }).format({ days, hours, minutes });
  }
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ');
}

export function percent(used: number | null, limit: number | null): number | null {
  if (used === null || !limit || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}
