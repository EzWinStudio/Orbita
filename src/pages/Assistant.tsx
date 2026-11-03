import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Bot, Eraser, Sparkles, UserRound } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import type { AssistantMessage, AssistantStatus } from '../types';
import type { Page } from '../nav';

interface ChatItem extends AssistantMessage {
  id: number;
  source?: 'local' | 'model';
  navigate?: string | null;
  suggestions?: string[];
}

const STARTERS = [
  'Bu haftanın özeti',
  'Açık görevlerim',
  'Hangi servisler kapalı?',
  'Yeni şirket ekle: Nova Studio',
  'Görev ekle: haftalık video planı',
  'Güncellemeleri kontrol et',
];

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, index) => (
        <p key={index} className={line.trim() ? undefined : 'assistant-gap'}>
          {line.trim() ? renderInline(line) : '\u00a0'}
        </p>
      ))}
    </>
  );
}

interface AssistantProps {
  navigate: (page: Page, companyId?: string | null) => void;
}

export function Assistant({ navigate }: AssistantProps) {
  const { actions } = useApp();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 1,
      role: 'assistant',
      content:
        'Merhaba, ben **EZWIN Asistan**. Uygulamanı yönetebilir, verilerini özetleyebilir ve genel sorularını yanıtlayabilirim.\n\nNe yapmak istersin?',
      source: 'local',
      suggestions: STARTERS.slice(0, 4),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS.slice(0, 4));
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await window.ezwin?.assistant.status();
        if (payload) setStatus(payload);
      } catch {
        /* durum alınamazsa başlıkta model etiketi görünmez */
      }
    })();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    const userItem: ChatItem = { id: Date.now(), role: 'user', content: text };
    const history: AssistantMessage[] = [...messages, userItem]
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-10)
      .map((item) => ({ role: item.role, content: item.content }));
    setMessages((prev) => [...prev, userItem]);

    const result = await actions.askAssistant({ message: text, history });
    setBusy(false);

    if (!result) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Şu an yanıt veremedim. Biraz sonra tekrar dene.',
          source: 'local',
        },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.reply,
        source: result.source,
        navigate: result.navigate,
        suggestions: result.suggestions,
      },
    ]);
    if (result.suggestions.length > 0) setSuggestions(result.suggestions);
    inputRef.current?.focus();
  }

  function clearChat() {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        content:
          'Sohbet temizlendi. **EZWIN Asistan** hazır: özet isteyebilir, kayıt ekleyebilir veya genel bir soru sorabilirsin.',
        source: 'local',
        suggestions: STARTERS.slice(0, 4),
      },
    ]);
    setSuggestions(STARTERS.slice(0, 4));
  }

  return (
    <>
      <PageHeader
        eyebrow="Stüdyo"
        title={t('Asistan')}
        subtitle="Uygulamanı yöneten, verilerini özetleyen ve genel soruları yanıtlayan yardımcı. Yerel komutlar verini cihazda tutar."
        actions={
          <div className="assistant-head-actions">
            <span className="assistant-status">
              <Sparkles size={12} />
              {status ? `${status.modelLabel} · hazır` : 'hazırlanıyor…'}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearChat}>
              <Eraser size={13} /> Temizle
            </button>
          </div>
        }
      />

      <div className="card assistant-card">
        <div className="assistant-log" ref={listRef}>
          {messages.map((item) => (
            <div key={item.id} className={`assistant-row assistant-row-${item.role}`}>
              <span className={`assistant-avatar ${item.role}`}>
                {item.role === 'user' ? <UserRound size={15} /> : <Bot size={15} />}
              </span>
              <div className="assistant-bubble">
                <RichText text={item.content} />
                {item.navigate ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm assistant-nav"
                    onClick={() => navigate(item.navigate as Page)}
                  >
                    Sayfayı aç
                  </button>
                ) : null}
                {item.source ? (
                  <span className={`assistant-source ${item.source}`}>
                    {item.source === 'local' ? 'yerel' : 'model'}
                  </span>
                ) : null}
              </div>
            </div>
          ))}

          {busy ? (
            <div className="assistant-row assistant-row-assistant">
              <span className="assistant-avatar assistant">
                <Bot size={15} />
              </span>
              <div className="assistant-bubble assistant-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>

        <div className="assistant-suggestions">
          {suggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="assistant-chip"
              onClick={() => void send(suggestion)}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          className="assistant-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            ref={inputRef}
            className="assistant-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Bir komut yaz veya soru sor… Örn. “Görev ekle: video kurgusu”"
            rows={2}
            maxLength={2000}
          />
          <button
            type="submit"
            className="btn btn-primary assistant-send"
            disabled={busy || !input.trim()}
            aria-label="Gönder"
          >
            <ArrowUp size={16} />
          </button>
        </form>

        <p className="assistant-foot">
          Yerel komutlar cihazında çalışır. Yalnızca genel bilgi soruları model servisine gönderilir.
        </p>
      </div>
    </>
  );
}
