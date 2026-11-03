import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  ExternalLink,
  Inbox,
  Loader2,
  Mail as MailIcon,
  MailOpen,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { MailAccountModal } from '../modals/MailAccountModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { translateMessage, type TranslationKey } from '../i18n/core';
import { relativeTime } from '../lib/format';
import type {
  MailAccount,
  MailAccountError,
  MailAddress,
  MailFilter,
  MailMessage,
  MailSummary,
  MailboxKind,
} from '../types';

const MAILBOXES: { value: MailboxKind; label: TranslationKey; icon: typeof Inbox }[] = [
  { value: 'inbox', label: 'Gelen Kutusu', icon: Inbox },
  { value: 'all', label: 'Tüm Postalar', icon: MailIcon },
  { value: 'starred', label: 'Yıldızlı', icon: Star },
  { value: 'sent', label: 'Gönderilenler', icon: Send },
];

const FILTERS: { value: MailFilter; label: TranslationKey }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'unread', label: 'Okunmamış' },
  { value: 'starred', label: 'Yıldızlı' },
  { value: 'attachments', label: 'Ekli' },
];

const QUICK_SEARCHES: { label: TranslationKey; value: string }[] = [
  { label: 'Bugün', value: 'newer_than:1d' },
  { label: 'Bu hafta', value: 'newer_than:7d' },
  { label: 'Bu ay', value: 'newer_than:30d' },
];

function senderName(from: MailAddress[]): string {
  const first = from[0];
  if (!first) return '—';
  return first.name || first.address || '—';
}

function senderAddress(from: MailAddress[]): string {
  return from[0]?.address ?? '';
}

function addressLine(list: MailAddress[]): string {
  return list
    .map((item) => (item.name ? `${item.name} <${item.address}>` : item.address))
    .filter(Boolean)
    .join(', ');
}

function initialOf(value: string): string {
  const clean = value.trim();
  return clean ? clean.charAt(0).toUpperCase() : '?';
}

function formatAttachmentSize(size: number | null, locale: string): string {
  if (typeof size !== 'number' || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kb)} KB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kb / 1024)} MB`;
}

function formatMailDate(value: string | null, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mailKey(message: { accountId: string; uid: number; mailbox: string }): string {
  return `${message.accountId}:${message.uid}:${message.mailbox}`;
}

export function Mail() {
  const data = useAppData();
  const { actions, toast } = useApp();
  const { t, language, locale } = useI18n();

  const [accounts, setAccounts] = useState<MailAccount[]>(data.mailAccounts);
  const [accountId, setAccountId] = useState('all');
  const [mailbox, setMailbox] = useState<MailboxKind>('inbox');
  const [filter, setFilter] = useState<MailFilter>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [errors, setErrors] = useState<MailAccountError[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<MailSummary | null>(null);
  const [opened, setOpened] = useState<MailMessage | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [starBusy, setStarBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<MailAccount | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRequest = useRef(0);
  const readerRequest = useRef(0);

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((sum, value) => sum + value, 0),
    [unreadCounts],
  );

  const readableError = useCallback(
    (err: unknown, fallback: TranslationKey): string => {
      if (err instanceof Error && err.message) {
        return translateMessage(language, err.message);
      }
      return t(fallback);
    },
    [language, t],
  );

  const closeReader = useCallback(() => {
    readerRequest.current += 1;
    setSelected(null);
    setOpened(null);
    setReaderError(null);
    setReaderLoading(false);
  }, []);

  useEffect(() => {
    if (accountId !== 'all' && !accounts.some((account) => account.id === accountId)) {
      setAccountId('all');
    }
    setSelected((prev) =>
      prev && !accounts.some((account) => account.id === prev.accountId) ? null : prev,
    );
    setOpened((prev) =>
      prev && !accounts.some((account) => account.id === prev.accountId) ? null : prev,
    );
  }, [accounts, accountId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 380);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadList = useCallback(
    async (silent = false) => {
      const api = window.ezwin;
      if (!api) return;
      const request = listRequest.current + 1;
      listRequest.current = request;
      if (!silent) setLoading(true);
      try {
        const result = await api.mail.list({
          accountId: accountId === 'all' ? null : accountId,
          mailbox,
          filter,
          query: debouncedQuery,
          limit: 50,
        });
        if (listRequest.current !== request) return;
        setAccounts(result.accounts);
        setMessages(result.messages);
        setErrors(result.errors);
        setUnreadCounts(result.unreadCounts);
        setListError(null);
        const attempted = accountId === 'all' ? result.accounts.length : 1;
        if (result.errors.length < attempted) setLastSyncAt(Date.now());
      } catch (err) {
        if (listRequest.current !== request) return;
        setListError(readableError(err, 'Mail yüklenemedi.'));
      } finally {
        if (listRequest.current === request) setLoading(false);
      }
    },
    [accountId, mailbox, filter, debouncedQuery, readableError],
  );

  useEffect(() => {
    if (!accounts.length) {
      listRequest.current += 1;
      setMessages([]);
      setErrors([]);
      setUnreadCounts({});
      setListError(null);
      setLoading(false);
      setLastSyncAt(null);
      return;
    }
    void loadList();
  }, [accounts.length, reloadKey, loadList]);

  useEffect(() => {
    if (!accounts.length) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadList(true);
    }, 120000);
    return () => window.clearInterval(timer);
  }, [accounts.length, loadList]);

  const openMessage = async (summary: MailSummary) => {
    const api = window.ezwin;
    if (!api) return;
    setSelected(summary);
    setOpened(null);
    setReaderError(null);
    setReaderLoading(true);
    const request = readerRequest.current + 1;
    readerRequest.current = request;
    try {
      const message = await api.mail.read({
        accountId: summary.accountId,
        uid: summary.uid,
        mailbox: summary.mailbox,
      });
      if (readerRequest.current !== request) return;
      setOpened(message);
      setSelected((prev) =>
        prev && mailKey(prev) === mailKey(summary) ? { ...prev, unread: false } : prev,
      );
      setMessages((prev) => {
        const matches = (item: MailSummary) => mailKey(item) === mailKey(summary);
        if (filter === 'unread') return prev.filter((item) => !matches(item));
        return prev.map((item) => (matches(item) ? { ...item, unread: false } : item));
      });
      if (summary.unread) {
        setUnreadCounts((prev) => ({
          ...prev,
          [summary.accountId]: Math.max(0, (prev[summary.accountId] ?? 0) - 1),
        }));
      }
    } catch (err) {
      if (readerRequest.current !== request) return;
      setReaderError(readableError(err, 'Mail yüklenemedi.'));
    } finally {
      if (readerRequest.current === request) setReaderLoading(false);
    }
  };

  const toggleStar = async (target: MailSummary | MailMessage | null) => {
    if (!target || starBusy) return;
    const api = window.ezwin;
    if (!api) return;
    const starred = !target.starred;
    setStarBusy(true);
    try {
      await api.mail.star({
        accountId: target.accountId,
        uid: target.uid,
        mailbox: target.mailbox,
        starred,
      });
      const matches = (item: MailSummary) => mailKey(item) === mailKey(target);
      const remove = !starred && (mailbox === 'starred' || filter === 'starred');
      setMessages((prev) =>
        remove
          ? prev.filter((item) => !matches(item))
          : prev.map((item) => (matches(item) ? { ...item, starred } : item)),
      );
      setSelected((prev) => (prev && matches(prev) ? { ...prev, starred } : prev));
      setOpened((prev) => (prev && matches(prev) ? { ...prev, starred } : prev));
    } catch (err) {
      toast('error', readableError(err, 'Beklenmeyen bir hata oluştu.'));
    } finally {
      setStarBusy(false);
    }
  };

  const openInGmail = (summary: MailSummary) => {
    const account = accountById.get(summary.accountId);
    if (!account) return;
    const subject = summary.subject.trim().replace(/\s+/g, ' ').slice(0, 80);
    const from = senderAddress(summary.from);
    const searchTerm = subject
      ? `subject:"${subject.replace(/"/g, '')}"`
      : from
        ? `from:${from}`
        : '';
    const base = `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}`;
    void actions.openExternal(searchTerm ? `${base}#search/${encodeURIComponent(searchTerm)}` : base);
  };

  const handleAccountsSaved = (next: MailAccount[]) => {
    setAccounts(next);
    setReloadKey((key) => key + 1);
    if (accountId !== 'all' && !next.some((account) => account.id === accountId)) {
      setAccountId('all');
    }
  };

  const openAddAccount = () => {
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEditAccount = (account: MailAccount) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const changeMailbox = (next: MailboxKind) => {
    if (next === mailbox) return;
    closeReader();
    setMailbox(next);
  };

  const changeAccount = (next: string) => {
    if (next === accountId) return;
    closeReader();
    setAccountId(next);
  };

  const applyQuickSearch = (value: string) => {
    setQuery((prev) => (prev.trim() === value ? '' : value));
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const activeStarred = opened?.starred ?? selected?.starred ?? false;
  const readerAccount = selected ? accountById.get(selected.accountId) : null;
  const readerSource = opened ?? selected;
  const readerColor = readerAccount?.color ?? 'var(--accent)';
  const readerAccountLabel = readerAccount?.label ?? '';

  return (
    <div className="mail-page">
      <PageHeader
        eyebrow={t('Posta')}
        title={t('Posta kutusu')}
        subtitle={t('Tüm Gmail hesapların tek kutuda. Ara, filtrele ve oku.')}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadList()}
              disabled={!accounts.length || loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : undefined} />
              {t('Yenile')}
            </button>
            <button type="button" className="btn btn-primary" onClick={openAddAccount}>
              <Plus size={15} />
              {t('Hesap ekle')}
            </button>
          </>
        }
      />

      {accounts.length === 0 ? (
        <section className="card mail-onboarding">
          <div className="mail-onboarding-main">
            <span className="mail-onboarding-icon">
              <MailIcon size={25} />
            </span>
            <div>
              <h2>{t('Gmail hesabını bağla')}</h2>
              <p>{t('Tüm Gmail hesapların tek kutuda. Ara, filtrele ve oku.')}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={openAddAccount}>
              <Plus size={15} />
              {t('Hesap ekle')}
            </button>
          </div>
          <ol className="mail-steps">
            <li className="mail-step">
              <span className="mail-step-index">1</span>
              <p>{t('Google Hesabında 2 Adımlı Doğrulamayı aç.')}</p>
            </li>
            <li className="mail-step">
              <span className="mail-step-index">2</span>
              <p>{t('Uygulama şifreleri sayfasından Gmail için 16 haneli şifre oluştur.')}</p>
            </li>
            <li className="mail-step">
              <span className="mail-step-index">3</span>
              <p>{t('Buraya Gmail adresini ve uygulama şifresini gir.')}</p>
            </li>
          </ol>
          <div className="mail-security-note">
            <ShieldCheck size={14} />
            <p>{t('Şifreler yalnızca bu cihazda Windows DPAPI ile şifrelenir; mail içerikleri diske kaydedilmez.')}</p>
          </div>
        </section>
      ) : (
        <>
          <div className="mail-account-bar">
            <div className="mail-account-chips">
              <button
                type="button"
                className={`mail-account-pill ${accountId === 'all' ? 'active' : ''}`}
                onClick={() => changeAccount('all')}
              >
                <span>{t('Tümü')}</span>
                {totalUnread > 0 ? (
                  <span className="mail-account-unread">{totalUnread}</span>
                ) : null}
              </button>
              {accounts.map((account) => {
                const unread = unreadCounts[account.id] ?? 0;
                return (
                  <div
                    key={account.id}
                    className={`mail-account-chip-wrap ${accountId === account.id ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="mail-account-choice"
                      onClick={() => changeAccount(account.id)}
                      title={account.email}
                    >
                      <span
                        className="mail-account-dot"
                        style={{ background: account.color }}
                      />
                      <span className="mail-account-label">{account.label}</span>
                      {unread > 0 ? (
                        <span className="mail-account-unread">{unread}</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="mail-account-edit"
                      onClick={() => openEditAccount(account)}
                      aria-label={`${t('Hesabı düzenle')}: ${account.label}`}
                      title={t('Hesabı düzenle')}
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
            {lastSyncAt ? (
              <span className="mail-account-sync">
                {t('Son eşitleme: {time}', {
                  time: formatMailDate(new Date(lastSyncAt).toISOString(), locale),
                })}
              </span>
            ) : null}
          </div>

          {errors.length > 0 ? (
            <div className="mail-errors">
              {errors.map((error) => (
                <div className="mail-error" key={error.accountId}>
                  <AlertCircle size={15} />
                  <div>
                    <strong><bdi>{error.email}</bdi></strong>
                    <span>{translateMessage(language, error.message)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const account = accountById.get(error.accountId);
                      if (account) openEditAccount(account);
                    }}
                  >
                    {t('Hesabı düzenle')}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className={`mail-workbench ${selected ? 'has-selection' : ''}`}>
            <section className="mail-list-pane" aria-label={t('Posta kutusu')}>
              <div className="mail-toolbar">
                <div className="mail-search">
                  <Search size={14} />
                  <input
                    ref={searchRef}
                    dir="ltr"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        if (query) setQuery('');
                        else event.currentTarget.blur();
                      }
                    }}
                    placeholder={t('Gmail’de ara: from:, subject:, has:attachment…')}
                    aria-label={t('Gmail’de ara: from:, subject:, has:attachment…')}
                    spellCheck={false}
                  />
                  {query ? (
                    <button
                      type="button"
                      className="mail-search-clear"
                      onClick={() => {
                        setQuery('');
                        searchRef.current?.focus();
                      }}
                      aria-label={t('Aramayı temizle')}
                      title={t('Aramayı temizle')}
                    >
                      <X size={11} />
                    </button>
                  ) : (
                    <kbd className="mail-search-kbd">/</kbd>
                  )}
                </div>

                <div className="mail-quick">
                  {QUICK_SEARCHES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`mail-quick-chip ${query.trim() === item.value ? 'active' : ''}`}
                      onClick={() => applyQuickSearch(item.value)}
                    >
                      {t(item.label)}
                    </button>
                  ))}
                </div>
                <p className="mail-search-hint">
                  {t('Gmail araması from:, subject:, has:attachment ve newer_than:7d sözdizimini destekler.')}
                </p>

                <div className="mail-mailboxes" role="tablist" aria-label={t('Posta kutusu')}>
                  {MAILBOXES.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={mailbox === item.value}
                        className={`mail-mailbox ${mailbox === item.value ? 'active' : ''}`}
                        onClick={() => changeMailbox(item.value)}
                      >
                        <Icon size={12} />
                        <span>{t(item.label)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mail-filters">
                  {FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`mail-filter ${filter === item.value ? 'active' : ''}`}
                      onClick={() => setFilter(item.value)}
                    >
                      {t(item.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mail-list-head">
                <span>
                  {loading && messages.length > 0 ? <Loader2 size={10} className="spin" /> : null}
                  {t('{count} mail', { count: messages.length })}
                </span>
                {loading && messages.length === 0 ? <span>{t('Mail yükleniyor…')}</span> : null}
              </div>

              <div className="mail-list-scroll">
                {listError ? (
                  <div className="mail-list-state">
                    <AlertCircle size={22} />
                    <strong>{listError}</strong>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void loadList()}
                    >
                      <RefreshCw size={12} /> {t('Yeniden dene')}
                    </button>
                  </div>
                ) : loading && messages.length === 0 ? (
                  <div className="mail-list-state">
                    <Loader2 size={20} className="spin" />
                    <strong>{t('Mail yükleniyor…')}</strong>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mail-list-state">
                    {errors.length > 0 ? <AlertCircle size={22} /> : <Inbox size={22} />}
                    <strong>{errors.length > 0 ? t('Mail yüklenemedi.') : t('Mail yok')}</strong>
                    <p>
                      {errors.length > 0
                        ? t('Hesap bağlantısını düzeltip yeniden dene.')
                        : debouncedQuery || filter !== 'all'
                          ? t('Bu filtrede mail yok.')
                          : t('Aramayı veya filtreleri değiştirmeyi dene.')}
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const account = accountById.get(message.accountId);
                    const active = selected ? mailKey(selected) === mailKey(message) : false;
                    return (
                      <button
                        key={mailKey(message)}
                        type="button"
                        className={`mail-item ${message.unread ? 'unread' : ''} ${active ? 'selected' : ''}`}
                        onClick={() => void openMessage(message)}
                      >
                        <span
                          className="mail-item-stripe"
                          style={{ background: account?.color ?? 'var(--accent)' }}
                        />
                        <span className="mail-item-top">
                          <span className="mail-item-from" dir="auto">{senderName(message.from)}</span>
                          <span className="mail-item-date">
                            {message.date ? relativeTime(Date.parse(message.date)) : '—'}
                          </span>
                        </span>
                        <span className="mail-item-subject" dir="auto">
                          {message.subject || t('Konu yok')}
                        </span>
                        <span className="mail-item-meta">
                          <span className="mail-item-account" dir="auto">
                            <i style={{ background: account?.color ?? 'var(--accent)' }} />
                            {account?.label ?? '—'}
                          </span>
                          <span className="mail-item-flags">
                            {message.hasAttachments ? <Paperclip size={10} /> : null}
                            {message.starred ? (
                              <Star size={10} className="mail-star-on" />
                            ) : null}
                            {message.unread ? <span className="mail-unread-dot" /> : null}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="mail-reader" aria-live="polite">
              {!selected ? (
                <div className="mail-reader-empty">
                  <span className="mail-reader-icon">
                    <MailOpen size={24} />
                  </span>
                  <strong>{t('Bir mail seç')}</strong>
                  <p>{t('Listeden bir e-posta aç; içeriği burada güvenli düz metin olarak görünür.')}</p>
                </div>
              ) : (
                <>
                  <div className="mail-reader-top">
                    <button
                      type="button"
                      className="icon-btn mail-reader-back"
                      onClick={closeReader}
                      aria-label={t('Geri')}
                      title={t('Geri')}
                    >
                      <ArrowLeft size={15} />
                    </button>
                    <span className="mail-reader-account">
                      <i style={{ background: readerColor }} />
                      {readerAccountLabel}
                    </span>
                    <div className="mail-reader-actions">
                      <button
                        type="button"
                        className={`icon-btn ${activeStarred ? 'starred' : ''}`}
                        onClick={() => void toggleStar(readerSource)}
                        disabled={starBusy}
                        aria-label={activeStarred ? t('Yıldızı kaldır') : t('Yıldızla')}
                        title={activeStarred ? t('Yıldızı kaldır') : t('Yıldızla')}
                      >
                        {starBusy ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <Star size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openInGmail(selected)}
                      >
                        <ExternalLink size={12} />
                        {t('Gmail’de aç')}
                      </button>
                    </div>
                  </div>

                  <div className="mail-reader-scroll">
                    {readerLoading ? (
                      <div className="mail-reader-state">
                        <Loader2 size={22} className="spin" />
                        <strong>{t('Mail yükleniyor…')}</strong>
                      </div>
                    ) : readerError ? (
                      <div className="mail-reader-state is-error">
                        <AlertCircle size={22} />
                        <strong>{readerError}</strong>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void openMessage(selected)}
                        >
                          <RefreshCw size={12} /> {t('Yeniden dene')}
                        </button>
                      </div>
                    ) : opened ? (
                      <>
                        <h2 className="mail-reader-subject" dir="auto">
                          {opened.subject || t('Konu yok')}
                        </h2>
                        <div className="mail-reader-sender">
                          <span
                            className="mail-avatar"
                            style={{ background: readerColor }}
                          >
                            {initialOf(senderName(opened.from))}
                          </span>
                          <div className="mail-sender-info">
                            <strong dir="auto">{senderName(opened.from)}</strong>
                            {senderAddress(opened.from) ? (
                              <span>
                                <bdi>{senderAddress(opened.from)}</bdi>
                              </span>
                            ) : null}
                          </div>
                          <span className="mail-reader-date">
                            {formatMailDate(opened.date, locale)}
                          </span>
                        </div>

                        <div className="mail-addresses">
                          <div className="mail-address-line">
                            <b>{t('Kime')}:</b>
                            <span>
                              <bdi>{addressLine(opened.to) || '—'}</bdi>
                            </span>
                          </div>
                          {opened.cc.length > 0 ? (
                            <div className="mail-address-line">
                              <b>{t('Bilgi')}:</b>
                              <span>
                                <bdi>{addressLine(opened.cc)}</bdi>
                              </span>
                            </div>
                          ) : null}
                          <div className="mail-address-line">
                            <b>{t('Kimden')}:</b>
                            <span>
                              <bdi>{addressLine(opened.from) || '—'}</bdi>
                            </span>
                          </div>
                        </div>

                        <div className="mail-body" dir="auto">
                          {opened.text ? opened.text : t('Bu mailde metin içeriği yok.')}
                        </div>
                        {opened.truncated ? (
                          <p className="mail-truncated">{t('İçerik kısaltıldı.')}</p>
                        ) : null}

                        {opened.attachments.length > 0 ? (
                          <div className="mail-attachments">
                            <h3>
                              <Paperclip size={12} />
                              {t('Ekler')}
                              <span>{opened.attachments.length}</span>
                            </h3>
                            {opened.attachments.map((attachment, index) => (
                              <div className="mail-attachment" key={`${attachment.filename}-${index}`}>
                                <FileText size={15} />
                                <div className="mail-attachment-info">
                                  <strong dir="auto">{attachment.filename}</strong>
                                  <span>
                                    {attachment.contentType} ·{' '}
                                    {formatAttachmentSize(attachment.size, locale)}
                                  </span>
                                </div>
                              </div>
                            ))}
                            <p className="mail-attachment-note">
                              {t('Ekler yalnızca listelenir; indirmek için Gmail’de aç.')}
                            </p>
                          </div>
                        ) : null}

                        <div className="mail-reader-security">
                          <ShieldCheck size={13} />
                          <p>
                            {t('Gmail içeriği düz metne çevrilir; uzak görseller ve izleme kodları yüklenmez.')}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}

      <MailAccountModal
        open={modalOpen}
        account={editingAccount}
        onClose={() => setModalOpen(false)}
        onSaved={handleAccountsSaved}
      />
    </div>
  );
}
