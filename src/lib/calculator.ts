import { getLocale } from '../i18n/core';

export class CalculatorError extends Error {}

function normalize(input: string): string {
  return input
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

export function evaluateExpression(input: string): number {
  const source = normalize(input);
  if (!source) throw new CalculatorError('Bir ifade gir.');
  if (source.length > 160) throw new CalculatorError('İfade çok uzun.');

  let index = 0;
  const peek = () => source[index];

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const operator = source[index++];
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const operator = source[index++];
      const right = parseUnary();
      if (operator === '/' && right === 0) throw new CalculatorError('Sıfıra bölme yapılamaz.');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === '+' || peek() === '-') {
      const operator = source[index++];
      const value = parseUnary();
      return operator === '-' ? -value : value;
    }
    return parsePostfix();
  }

  function parsePostfix(): number {
    let value = parsePrimary();
    while (peek() === '%') {
      index += 1;
      value /= 100;
    }
    return value;
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      index += 1;
      const value = parseExpression();
      if (peek() !== ')') throw new CalculatorError('Parantez kapanmıyor.');
      index += 1;
      return value;
    }
    if (peek() === ')') throw new CalculatorError('Fazladan parantez var.');
    const start = index;
    while (index < source.length && /[0-9.]/.test(source[index])) index += 1;
    if (start === index) throw new CalculatorError('İfade eksik veya geçersiz.');
    const raw = source.slice(start, index);
    if ((raw.match(/\./g) || []).length > 1) throw new CalculatorError('Ondalık ayıracı geçersiz.');
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new CalculatorError('Sayı geçersiz.');
    return value;
  }

  const value = parseExpression();
  if (index < source.length) throw new CalculatorError('İfade geçersiz.');
  if (!Number.isFinite(value)) throw new CalculatorError('Sonuç hesaplanamadı.');
  if (Math.abs(value) > 1e15) throw new CalculatorError('Sonuç çok büyük.');
  if (value !== 0 && Math.abs(value) < 1e-12) throw new CalculatorError('Sonuç çok küçük.');
  return value;
}

export function toExpressionString(value: number): string {
  const raw = String(value);
  if (!/[eE]/.test(raw)) return raw;
  return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatCalculatorValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
    return new Intl.NumberFormat(getLocale(), { maximumSignificantDigits: 12 }).format(value);
  }
  return new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: 10,
    minimumFractionDigits: 0,
  }).format(value);
}

export function decimalSeparator(): string {
  return new Intl.NumberFormat(getLocale()).format(1.1).replace(/\d/g, '');
}

export function prettyExpression(expression: string): string {
  return expression
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/-/g, ' − ')
    .replace(/\+/g, ' + ')
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .replace(/\./g, decimalSeparator())
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
