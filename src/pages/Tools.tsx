import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeftRight,
  Calculator as CalculatorIcon,
  History,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { CURRENCIES, CURRENCY_LABEL, newId } from '../constants';
import { formatMoney, relativeTime } from '../lib/format';
import {
  decimalSeparator,
  evaluateExpression,
  formatCalculatorValue,
  parseDecimalInput,
  prettyExpression,
  toExpressionString,
} from '../lib/calculator';
import { crossRate, formatRate, rateDateLabel } from '../lib/rates';
import { scopedStorageKey } from '../web/workspaceScope';
import type { Currency } from '../types';

const HISTORY_KEY = 'ezwin.calc.history';

interface HistoryItem {
  id: string;
  expression: string;
  result: number;
  at: number;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(scopedStorageKey(HISTORY_KEY)) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item) =>
          item &&
          typeof item.expression === 'string' &&
          typeof item.result === 'number' &&
          Number.isFinite(item.result),
      )
      .slice(0, 20)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : newId(),
        expression: item.expression,
        result: item.result,
        at: typeof item.at === 'number' ? item.at : Date.now(),
      }));
  } catch {
    return [];
  }
}

function Calculator() {
  const { t, language } = useI18n();
  const [expression, setExpression] = useState('');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    surfaceRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(scopedStorageKey(HISTORY_KEY), JSON.stringify(history));
    } catch {
      return;
    }
  }, [history]);

  const preview = useMemo(() => {
    const text = expression.trim();
    if (!text || /[+\-*/(.]$/.test(text)) return null;
    try {
      return evaluateExpression(text);
    } catch {
      return null;
    }
  }, [expression]);

  const displayExpression = prettyExpression(expression);

  const append = (token: string) => {
    setError(null);
    setExpression((current) => {
      let text = current;
      if (justEvaluated) {
        const startsNew = /^[0-9(]$/.test(token) || token === '.';
        if (startsNew) text = '';
      }
      if (text.length >= 120) return text;

      if (token === '.') {
        const segment = text.split(/[+\-*/()%]/).pop() ?? '';
        if (segment.includes('.')) return text;
        if (!segment) text += '0';
        return `${text}.`;
      }

      if ('+-*/'.includes(token)) {
        if (!text) return token === '-' ? '-' : text;
        const last = text.slice(-1);
        if ('+-*/'.includes(last)) return `${text.slice(0, -1)}${token}`;
        if (last === '(') return token === '-' ? `${text}-` : text;
        return text + token;
      }

      if (token === '%') {
        if (!text || /[+\-*/(]$/.test(text)) return text;
        return `${text}%`;
      }

      if (token === '(') {
        if (text && /[0-9.)%]$/.test(text)) return `${text}*(`;
        return `${text}(`;
      }

      if (token === ')') {
        const openings = (text.match(/\(/g) || []).length;
        const closings = (text.match(/\)/g) || []).length;
        if (openings <= closings || /[+\-*/(]$/.test(text)) return text;
        return `${text})`;
      }

      return text + token;
    });
    setJustEvaluated(false);
  };

  const backspace = () => {
    setError(null);
    setExpression((current) => current.slice(0, -1));
    setJustEvaluated(false);
  };

  const clear = () => {
    setExpression('');
    setError(null);
    setJustEvaluated(false);
  };

  const commit = () => {
    if (!expression.trim()) return;
    try {
      const value = evaluateExpression(expression);
      const item: HistoryItem = {
        id: newId(),
        expression,
        result: value,
        at: Date.now(),
      };
      setHistory((current) => [item, ...current].slice(0, 20));
      setExpression(toExpressionString(value));
      setJustEvaluated(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('İfade hesaplanamadı.');
      setError(translateMessage(language, message));
      setJustEvaluated(false);
    }
  };

  const restore = (item: HistoryItem) => {
    setExpression(toExpressionString(item.result));
    setJustEvaluated(true);
    setError(null);
    surfaceRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      append(key);
      return;
    }
    if (key === '.' || key === ',') {
      event.preventDefault();
      append('.');
      return;
    }
    if (key === '+' || key === '-' || key === '*' || key === '/') {
      event.preventDefault();
      append(key);
      return;
    }
    if (key === '%' || key === '(' || key === ')') {
      event.preventDefault();
      append(key);
      return;
    }
    if (key === 'Enter' || key === '=') {
      event.preventDefault();
      commit();
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      backspace();
      return;
    }
    if (key === 'Escape' || key === 'Delete') {
      event.preventDefault();
      clear();
    }
  };

  return (
    <div className="calc-layout">
      <div
        ref={surfaceRef}
        className="calc-main"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={t('Hesap makinesi. Klavyeden sayı, işlem ve Enter tuşlarını kullanabilirsin.')}
      >
        <div className="calc-display">
          <div className="calc-expression" title={t('İfade')}>
            {displayExpression}
          </div>
          <div className={`calc-result ${error ? 'is-error' : ''}`} aria-live="polite">
            {error ??
              (expression.trim()
                ? preview !== null
                  ? formatCalculatorValue(preview)
                  : '—'
                : '0')}
          </div>
        </div>

        <div className="calc-keys">
          <button type="button" className="calc-key calc-key-fn" onClick={clear}>
            C
          </button>
          <button type="button" className="calc-key calc-key-fn" onClick={backspace} aria-label={t('Son karakteri sil')}>
            ⌫
          </button>
          <button type="button" className="calc-key calc-key-fn" onClick={() => append('(')} aria-label={t('Sol parantez')}>
            (
          </button>
          <button type="button" className="calc-key calc-key-fn" onClick={() => append(')')} aria-label={t('Sağ parantez')}>
            )
          </button>

          {['7', '8', '9'].map((key) => (
            <button type="button" className="calc-key" key={key} onClick={() => append(key)}>
              {key}
            </button>
          ))}
          <button type="button" className="calc-key calc-key-op" onClick={() => append('/')} aria-label={t('Böl')}>
            ÷
          </button>

          {['4', '5', '6'].map((key) => (
            <button type="button" className="calc-key" key={key} onClick={() => append(key)}>
              {key}
            </button>
          ))}
          <button type="button" className="calc-key calc-key-op" onClick={() => append('*')} aria-label={t('Çarp')}>
            ×
          </button>

          {['1', '2', '3'].map((key) => (
            <button type="button" className="calc-key" key={key} onClick={() => append(key)}>
              {key}
            </button>
          ))}
          <button type="button" className="calc-key calc-key-op" onClick={() => append('-')} aria-label={t('Çıkar')}>
            −
          </button>

          <button type="button" className="calc-key calc-key-fn" onClick={() => append('%')} aria-label={t('Yüzde')}>
            %
          </button>
          <button type="button" className="calc-key" onClick={() => append('0')}>
            0
          </button>
          <button type="button" className="calc-key" onClick={() => append('.')} aria-label={t('Ondalık ayıracı')}>
            {decimalSeparator()}
          </button>
          <button type="button" className="calc-key calc-key-op" onClick={() => append('+')} aria-label={t('Topla')}>
            +
          </button>

          <button type="button" className="calc-key calc-key-equals" onClick={commit}>
            =
          </button>
        </div>

        <p className="calc-hint">
          {t('Klavye: sayılar, + − × ÷, Enter, Backspace · Esc temizler')}
        </p>
      </div>

      <aside className="calc-history">
        <div className="calc-history-head">
          <span>
            <History size={13} /> {t('Geçmiş')}
          </span>
          {history.length > 0 ? (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setHistory([])}
              aria-label={t('Hesap geçmişini temizle')}
              title={t('Geçmişi temizle')}
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="calc-history-empty">{t('Henüz hesaplama yok.')}</p>
        ) : (
          <div className="calc-history-list">
            {history.map((item) => (
              <button
                type="button"
                className="calc-history-item"
                key={item.id}
                onClick={() => restore(item)}
                title={t('Sonucu hesap makinesine aktar')}
              >
                <span className="calc-history-expression">{prettyExpression(item.expression)}</span>
                <span className="calc-history-result">= {formatCalculatorValue(item.result)}</span>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Converter() {
  const { t, language } = useI18n();
  const { rates, ratesLoading, ratesError } = useApp();
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('TRY');

  const numericAmount = parseDecimalInput(amount);
  const rate = rates ? crossRate(rates, from, to) : null;
  const converted = numericAmount !== null && rate !== null ? numericAmount * rate : null;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const updateAmount = (value: string) => {
    if (value === '' || /^\d*[.,]?\d*$/.test(value)) setAmount(value);
  };

  return (
    <section className="card converter-card">
      <div className="card-header">
        <div>
          <h2>{t('Para birimi dönüştürücü')}</h2>
          <p>{t('ECB referans kurlarıyla anında çevir.')}</p>
        </div>
      </div>

      <label className="form-field">
        <span className="form-label">{t('Tutar')}</span>
        <input
          className="input converter-amount"
          value={amount}
          onChange={(event) => updateAmount(event.target.value)}
          inputMode="decimal"
          placeholder="100"
          aria-label={t('Dönüştürülecek tutar')}
        />
      </label>

      <div className="converter-pair">
        <label className="form-field">
          <span className="form-label">{t('Kaynak')}</span>
          <select
            className="input select"
            value={from}
            onChange={(event) => setFrom(event.target.value as Currency)}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {t(CURRENCY_LABEL[currency])}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="converter-swap"
          onClick={swap}
          aria-label={t('Para birimlerini ters çevir')}
          title={t('Ters çevir')}
        >
          <ArrowLeftRight size={15} />
        </button>

        <label className="form-field">
          <span className="form-label">{t('Hedef')}</span>
          <select
            className="input select"
            value={to}
            onChange={(event) => setTo(event.target.value as Currency)}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {t(CURRENCY_LABEL[currency])}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="converter-output">
        <span className="converter-output-label">{t('Sonuç')}</span>
        <strong className="converter-output-value">
          {converted !== null ? formatMoney(converted, to) : ratesLoading ? t('Kur yükleniyor…') : '—'}
        </strong>
        {rate !== null ? (
          <span className="converter-output-rate">
            1 {from} = {formatRate(rate)} {to}
          </span>
        ) : null}
        {!rates && ratesError ? (
          <span className="converter-error">{translateMessage(language, ratesError)}</span>
        ) : null}
      </div>

      <div className="rate-source-line">
        {rates ? (
          <>
            <span className={`rate-state ${rates.stale ? 'is-stale' : ''}`}>
              {rates.stale ? t('Önbellek') : t('Güncel')}
            </span>
            <span>{rates.source}</span>
            {rateDateLabel(rates) ? <span>· {rateDateLabel(rates)}</span> : null}
            <span className="rate-source-sep">·</span>
            <span>{relativeTime(rates.fetchedAt)}</span>
          </>
        ) : (
          <span>{t('Kur kaynağı: ECB referans kurları')}</span>
        )}
      </div>
    </section>
  );
}

function MarketRates() {
  const { t, language } = useI18n();
  const { rates, ratesLoading, ratesError } = useApp();

  const rows = rates
    ? [
        { label: 'USD → TRY', value: crossRate(rates, 'USD', 'TRY') },
        { label: 'EUR → TRY', value: crossRate(rates, 'EUR', 'TRY') },
        { label: 'EUR → USD', value: crossRate(rates, 'EUR', 'USD') },
      ]
    : [];

  return (
    <section className="card rates-card">
      <div className="card-header">
        <div>
          <h2>{t('Piyasa')}</h2>
          <p>{t('ECB referans çapraz kurları.')}</p>
        </div>
        {rates ? (
          <span className={`rate-live-chip ${rates.stale ? 'is-stale' : ''}`}>
            <span className={`live-dot ${rates.stale ? 'is-stale' : ''}`} />
            {rates.stale ? t('Önbellek') : t('Güncel')}
          </span>
        ) : null}
      </div>

      {rates ? (
        <>
          <div className="rate-rows">
            {rows.map((row) => (
              <div className="rate-row" key={row.label}>
                <span className="rate-row-label">{row.label}</span>
                <strong className="rate-row-value">{formatRate(row.value)}</strong>
              </div>
            ))}
          </div>
          <div className="rate-card-footer">
            <span>{rates.source}</span>
            {rateDateLabel(rates) ? <span>· {rateDateLabel(rates)}</span> : null}
            <span className="rate-card-refresh">{ratesLoading ? t('Yenileniyor…') : relativeTime(rates.fetchedAt)}</span>
          </div>
        </>
      ) : (
        <div className="rates-unavailable">
          <span className={`live-dot ${ratesError ? 'is-error' : ''}`} />
          <strong>{ratesLoading ? t('Kur yükleniyor…') : t('Kur alınamadı')}</strong>
          <p>
            {ratesError
              ? translateMessage(language, ratesError)
              : t('ECB referans kurlarına ulaşılamadı. İnternet bağlantısını kontrol edip yeniden dene.')}
          </p>
        </div>
      )}
    </section>
  );
}

export function Tools() {
  const { t } = useI18n();
  const { ratesLoading, refreshRates } = useApp();

  return (
    <>
      <PageHeader
        eyebrow={t('Araçlar')}
        title={t('Hesap & Kur')}
        subtitle={t('Hesap makinesi, canlı döviz kurları ve para birimi dönüştürücü tek ekranda.')}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void refreshRates(true)}
            disabled={ratesLoading}
          >
            <RefreshCw size={14} className={ratesLoading ? 'spin' : undefined} />
            {ratesLoading ? t('Yenileniyor…') : t('Kuru yenile')}
          </button>
        }
      />

      <div className="dash-grid tools-grid">
        <section className="card span-7 calculator-card">
          <div className="card-header">
            <div>
              <h2>
                <CalculatorIcon size={16} /> {t('Hesap makinesi')}
              </h2>
              <p>{t('Dört işlem, parantez ve yüzde. Geçmiş bu cihazda saklanır.')}</p>
            </div>
          </div>
          <Calculator />
        </section>

        <div className="span-5 tools-side">
          <Converter />
          <MarketRates />
        </div>
      </div>
    </>
  );
}
