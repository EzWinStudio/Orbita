import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Languages, Loader2, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import type { TranslationKey } from '../i18n/core';
import { IS_WEB } from '../lib/runtime';
import { copyText } from '../lib/clipboard';
import {
  TRANSLATE_LANGUAGE_CODES,
  isTranslateLanguage,
  translateTextWeb,
} from '../web/webTranslate';

interface HistoryItem {
  id: number;
  source: string;
  target: string;
  text: string;
  result: string;
}

interface LanguageOption {
  code: string;
  name: string;
}

const SAMPLES: TranslationKey[] = [
  'Merhaba, nasılsın?',
  'Bu hafta üç yeni video hazırlıyorum.',
];

function safeCode(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (IS_WEB) return isTranslateLanguage(value) ? value : fallback;
  return value;
}

export function Translate() {
  const { data, actions, toast } = useApp();
  const { t, locale, language } = useI18n();
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const initialSource = safeCode(data?.settings.translateSource, 'tr');
  const initialTarget = safeCode(data?.settings.translateTarget, 'en');
  const [source, setSource] = useState(initialSource);
  const [target, setTarget] = useState(
    initialTarget === initialSource ? (initialSource === 'en' ? 'tr' : 'en') : initialTarget,
  );
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [engine, setEngine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const requestRef = useRef(0);

  const webLanguages = useMemo<LanguageOption[]>(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      names = null;
    }
    return TRANSLATE_LANGUAGE_CODES.map((code) => ({
      code,
      name: names?.of(code) ?? code.toUpperCase(),
    }));
  }, [locale]);

  const options = IS_WEB ? webLanguages : languages;

  useEffect(() => {
    if (IS_WEB) return;
    let active = true;
    void (async () => {
      try {
        const list = await window.ezwin?.translate.languages();
        if (active && list) setLanguages(list);
      } catch {
        if (active) setError(t('Dil listesi yüklenemedi.'));
      }
    })();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    const clean = text.trim();
    if (!clean) {
      setResult('');
      setError(null);
      setBusy(false);
      return;
    }

    const request = requestRef.current + 1;
    requestRef.current = request;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          const response = IS_WEB
            ? await translateTextWeb({ text: clean, source, target })
            : await actions.translateText({ text: clean, source, target });
          if (requestRef.current !== request) return;
          if (!response) throw new Error('Çeviri alınamadı. Biraz sonra tekrar dene.');
          setResult(response.text);
          setEngine(response.engine);
          setBusy(false);
          setHistory((prev) =>
            [
              { id: Date.now(), source, target, text: clean, result: response.text },
              ...prev.filter((item) => item.text !== clean || item.target !== target),
            ].slice(0, 6),
          );
        } catch (err) {
          if (requestRef.current !== request) return;
          setBusy(false);
          setError(
            translateMessage(
              language,
              err instanceof Error ? err.message : 'Çeviri alınamadı. Biraz sonra tekrar dene.',
            ),
          );
        }
      })();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [text, source, target, actions, language]);

  async function copy() {
    if (!result) return;
    const copied = await copyText(result);
    toast(copied ? 'success' : 'error', t(copied ? 'Çeviri kopyalandı.' : 'Kopyalanamadı.'));
  }

  function swap() {
    if (source === 'auto') {
      toast('info', t('Takas için kaynak dili seç.'));
      return;
    }
    const nextSource = target;
    const nextTarget = source;
    setSource(nextSource);
    setTarget(nextTarget);
    setText(result || text);
    setResult('');
    void actions.updateSettings({ translateSource: nextSource, translateTarget: nextTarget });
  }

  function changeSource(value: string) {
    setSource(value);
    void actions.updateSettings({ translateSource: value });
  }

  function changeTarget(value: string) {
    setTarget(value);
    void actions.updateSettings({ translateTarget: value });
  }

  return (
    <>
      <PageHeader
        eyebrow={t('Stüdyo')}
        title={t('Aktif çeviri')}
        subtitle={t('Yazarken çevrilir; metin yalnızca çeviri servisine gönderilir ve burada saklanmaz.')}
        actions={
          <span className="translate-engine">
            {busy ? t('çevriliyor…') : engine ? `${engine} · ${t('canlı')}` : t('bekliyor')}
          </span>
        }
      />

      <div className="translate-grid">
        <div className="card translate-pane">
          <div className="translate-bar">
            <select
              className="input translate-select"
              value={source}
              onChange={(event) => changeSource(event.target.value)}
              aria-label={t('Kaynak dil')}
            >
              {options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
            <span className="translate-count">{text.length} / 5000</span>
          </div>
          <textarea
            className="translate-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={5000}
            placeholder={t('Çevrilecek metni yaz…')}
            spellCheck={false}
          />
          <div className="translate-samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setText(t(sample));
                  setResult('');
                }}
              >
                {t(sample).slice(0, 26)}…
              </button>
            ))}
          </div>
        </div>

        <div className="translate-swap">
          <button
            type="button"
            className="translate-swap-btn"
            onClick={swap}
            aria-label={t('Dilleri değiştir')}
            title={t('Dilleri değiştir')}
          >
            <ArrowLeftRight size={15} />
          </button>
        </div>

        <div className="card translate-pane translate-pane-output">
          <div className="translate-bar">
            <select
              className="input translate-select"
              value={target}
              onChange={(event) => changeTarget(event.target.value)}
              aria-label={t('Hedef dil')}
            >
              {options
                .filter((option) => option.code !== 'auto')
                .map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
            </select>
            <div className="translate-tools">
              {busy ? <Loader2 size={14} className="translate-spin" /> : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy()} disabled={!result}>
                <Copy size={13} /> {t('Kopyala')}
              </button>
            </div>
          </div>
          <div className="translate-output">
            {result || (
              <span className="translate-placeholder">
                {busy ? t('Çevriliyor…') : t('Çeviri burada görünecek.')}
              </span>
            )}
          </div>
          <div className="translate-foot">
            <span>
              <Languages size={13} /> {source === 'auto' ? t('otomatik') : source.toUpperCase()} →{' '}
              {target.toUpperCase()}
            </span>
            {error ? <span className="translate-error">{error}</span> : null}
          </div>
        </div>
      </div>

      <p className="setting-note translate-privacy">
        {t('Metin, çeviri için MyMemory servisine gönderilir; Orbita sunucusunda saklanmaz.')}
      </p>

      <div className="card">
        <div className="card-header">
          <h2>{t('Son çeviriler')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setHistory([])}
            disabled={history.length === 0}
          >
            <Trash2 size={13} /> {t('Temizle')}
          </button>
        </div>
        {history.length === 0 ? (
          <p className="translate-empty">{t('Bu oturumdaki çeviriler burada listelenir.')}</p>
        ) : (
          <ul className="translate-history">
            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="translate-history-item"
                  onClick={() => {
                    setSource(item.source);
                    setTarget(item.target);
                    setText(item.text);
                  }}
                >
                  <span className="translate-history-lang">
                    {item.source.toUpperCase()} → {item.target.toUpperCase()}
                  </span>
                  <span className="translate-history-text">{item.text}</span>
                  <span className="translate-history-result">{item.result}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
