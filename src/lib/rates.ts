import type { Currency, RatesPayload } from '../types';
import { getLocale } from '../i18n/core';

export function unitsPerUsd(rates: RatesPayload, currency: Currency): number {
  if (currency === 'USD') return 1;
  return rates.rates[currency];
}

export function crossRate(rates: RatesPayload, from: Currency, to: Currency): number {
  return unitsPerUsd(rates, to) / unitsPerUsd(rates, from);
}

export function formatRate(value: number, maxDigits = 4): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  }).format(value);
}

export function rateDateLabel(rates: RatesPayload | null): string {
  if (!rates || !rates.rateDate) return '';
  const date = new Date(`${rates.rateDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
