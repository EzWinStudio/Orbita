import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Bot, Eraser, Sparkles, UserRound } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { companyHealthRows, buildInsights, openBugs, expiringContracts, employeeRanking } from '../lib/enterprise';
import { formatMoney, todayISO } from '../lib/format';
import type { AssistantMessage, AssistantStatus } from '../types';
import type { Page } from '../nav';

interface ChatItem extends AssistantMessage {
  id: number;
  source?: 'local' | 'model';
  navigate?: string | null;
  suggestions?: string[];
}

const STARTERS = [
  'Şirket analizi',
  'Bu haftanın özeti',
  'Açık görevlerim',
  'Gelir gider özeti',
  'Sözleşme uyarıları',
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
  const data = useAppData();
  const { actions } = useApp();
  const { t } = useI18n();
  const [analysisCompany, setAnalysisCompany] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 1,
      role: 'assistant',
      content:
        'Merhaba, ben **Orbita Asistan**. Şirket verilerini analiz edebilir, uygulamanı yönetebilir ve genel sorularını yanıtlayabilirim.\n\nNe yapmak istersin?',
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

  function localReply(raw: string): { content: string; navigate?: Page; suggestions?: string[] } | null {
    const text = raw.toLocaleLowerCase('tr');
    const selected = data.companies.find((company) => company.id === analysisCompany) ?? null;
    const health = companyHealthRows(data);
    const scopedHealth = selected ? health.filter((row) => row.companyId === selected.id) : health;
    const currency = data.settings.currency;

    if (text.includes('şirket analizi') || text.includes('şirket analiz')) {
      const revenue = scopedHealth.reduce((sum, row) => sum + row.revenue, 0);
      const expense = scopedHealth.reduce((sum, row) => sum + row.expense, 0);
      const headcount = scopedHealth.reduce((sum, row) => sum + row.headcount, 0);
      const openTasks = scopedHealth.reduce((sum, row) => sum + row.openTasks, 0);
      const bugs = openBugs(data.bugs).filter((bug) => !selected || bug.companyId === selected.id);
      const insights = buildInsights(data, t)
        .filter((insight) => !selected || !insight.companyId || insight.companyId === selected.id)
        .slice(0, 4);
      const top = employeeRanking(data)
        .filter((employee) => employee.score !== null && (!selected || employee.companyId === selected.id))
        .slice(0, 3);
      const lines = [
        `**${selected ? selected.name : t('Tüm şirketler')} · ${t('şirket analizi')}**`,
        '',
        `${t('Gelir')}: ${formatMoney(revenue, currency)}`,
        `${t('Gider')}: ${formatMoney(expense, currency)}`,
        `${t('Net sonuç')}: ${formatMoney(revenue - expense, currency)}`,
        '',
        `${t('Aktif ekip')}: ${headcount} · ${t('Açık görev')}: ${openTasks} · ${t('Açık hata')}: ${bugs.length}`,
      ];
      if (top.length > 0) {
        lines.push('', `**${t('Öne çıkan ekip')}**`, ...top.map((employee) => `• ${employee.name} — ${employee.score}`));
      }
      if (insights.length > 0) {
        lines.push('', `**${t('Öncelikli sinyaller')}**`, ...insights.map((insight) => `• ${insight.title} — ${insight.detail}`));
      }
      lines.push('', t('Bu analiz yalnızca yerel kayıtlardan hesaplandı; dış servise veri gönderilmedi.'));
      return {
        content: lines.join('\n'),
        navigate: 'admin',
        suggestions: ['Gelir gider özeti', 'Açık hatalar', 'Sözleşme uyarıları'],
      };
    }

    if (text.includes('gelir') && (text.includes('gider') || text.includes('özet'))) {
      const lines = [`**${t('Gelir gider özeti')}**`, ''];
      for (const row of scopedHealth) {
        lines.push(
          `• ${row.name}: ${t('Gelir')} ${formatMoney(row.revenue, currency)} · ${t('Gider')} ${formatMoney(row.expense, currency)} · ${t('Net')} ${formatMoney(row.net, currency)}`,
        );
      }
      return { content: lines.join('\n'), navigate: 'finance', suggestions: ['Şirket analizi', 'Açık hatalar'] };
    }

    if (text.includes('açık hata') || text.includes('hatalar')) {
      const list = openBugs(data.bugs).filter((bug) => !selected || bug.companyId === selected.id);
      if (list.length === 0) {
        return { content: t('Açık hata kaydı yok.'), navigate: 'business' };
      }
      const lines = [`**${t('{count} açık hata', { count: list.length })}**`, ''];
      for (const bug of list.slice(0, 8)) {
        lines.push(`• [${bug.severity}] ${bug.title}`);
      }
      return { content: lines.join('\n'), navigate: 'business', suggestions: ['Sözleşme uyarıları', 'Şirket analizi'] };
    }

    if (text.includes('sözleşme')) {
      const list = expiringContracts(data.contracts, 30).filter((contract) => !selected || contract.companyId === selected.id);
      if (list.length === 0) {
        return { content: t('30 gün içinde sona eren sözleşme yok.'), navigate: 'business' };
      }
      const lines = [`**${t('{count} sözleşme yakında bitiyor', { count: list.length })}**`, ''];
      for (const contract of list) {
        lines.push(`• ${contract.title}${contract.endDate ? ` — ${contract.endDate}` : ''}`);
      }
      return { content: lines.join('\n'), navigate: 'business', suggestions: ['Şirket analizi', 'Gelir gider özeti'] };
    }

    if (text.includes('bugün') && text.includes('toplantı')) {
      const meetings = data.meetings.filter(
        (meeting) => meeting.date === todayISO() && meeting.status === 'planned',
      );
      return {
        content:
          meetings.length === 0
            ? t('Bugün planlanmış toplantı yok.')
            : `**${t('Bugünkü toplantılar')}**\n\n${meetings.map((meeting) => `• ${meeting.time} — ${meeting.title}`).join('\n')}`,
        navigate: 'communication',
      };
    }

    return null;
  }

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

    const local = localReply(text);
    if (local) {
      setBusy(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: local.content,
          source: 'local',
          navigate: local.navigate,
          suggestions: local.suggestions,
        },
      ]);
      if (local.suggestions && local.suggestions.length > 0) setSuggestions(local.suggestions);
      inputRef.current?.focus();
      return;
    }

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
          'Sohbet temizlendi. **Orbita Asistan** hazır: özet isteyebilir, kayıt ekleyebilir veya genel bir soru sorabilirsin.',
        source: 'local',
        suggestions: STARTERS.slice(0, 4),
      },
    ]);
    setSuggestions(STARTERS.slice(0, 4));
  }

  return (
    <>
      <PageHeader
        eyebrow={t('Stüdyo')}
        title={t('Asistan')}
        subtitle={t('Şirket verilerini analiz eden, uygulamayı yöneten ve genel soruları yanıtlayan yardımcı. Yerel analiz veriyi cihazda tutar.')}
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

      <div className="assistant-analysis-bar">
        <span className="assistant-analysis-label">
          <Sparkles size={14} /> {t('Şirket analizi')}
        </span>
        <select
          className="input select"
          value={analysisCompany}
          onChange={(event) => setAnalysisCompany(event.target.value)}
          aria-label={t('Şirket')}
        >
          <option value="">{t('Tüm şirketler')}</option>
          {data.companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void send('Şirket analizi')}
          disabled={busy}
        >
          {t('Analiz oluştur')}
        </button>
        <span className="assistant-analysis-note">
          {t('Yerel kayıtlardan hesaplanır; dış servise veri gönderilmez.')}
        </span>
      </div>

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
