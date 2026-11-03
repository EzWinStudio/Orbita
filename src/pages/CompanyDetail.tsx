import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Cable,
  Check,
  FileText,
  Link2,
  ListChecks,
  Pencil,
  Pin,
  Plus,
  Wallet,
} from 'lucide-react';
import { StatusPill } from '../components/StatusPill';
import { CompanyAvatar } from '../components/CompanyAvatar';
import { LinkAvatar, ServiceAvatar } from '../components/BrandAvatar';
import { EmptyState } from '../components/EmptyState';
import { YoutubeCompanyCard } from '../components/YoutubeCompanyCard';
import { CompanyModal } from '../modals/CompanyModal';
import { AssetModal } from '../modals/AssetModal';
import { LinkModal } from '../modals/LinkModal';
import { TaskModal } from '../modals/TaskModal';
import { NoteModal } from '../modals/NoteModal';
import { EntryModal } from '../modals/EntryModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { companyHealth, serviceStateLabel, serviceSummary } from '../lib/status';
import { useBotHints } from '../web/botSecrets';
import { IS_TRAY, IS_WEB } from '../lib/runtime';
import {
  COMPANY_CATEGORY_LABEL,
  COMPANY_HEALTH_LABEL,
  COMPANY_HEALTH_STATE,
  COMPANY_STATUS_LABEL,
} from '../constants';
import type { Asset, LinkItem, Note, Task } from '../types';
import type { Page } from '../nav';
import {
  currentMonthKey,
  dueLabel,
  formatDate,
  formatMoney,
  relativeTime,
  todayISO,
} from '../lib/format';

interface CompanyDetailProps {
  companyId: string;
  navigate: (page: Page, companyId?: string | null) => void;
}

export function CompanyDetail({ companyId, navigate }: CompanyDetailProps) {
  const data = useAppData();
  const { actions } = useApp();
  const { t, locale } = useI18n();
  const botHints = useBotHints();

  const company = data.companies.find((item) => item.id === companyId);

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!company) navigate('companies');
  }, [company, navigate]);

  const monthKey = currentMonthKey();
  const today = todayISO();
  const currency = data.settings.currency;

  const assets = useMemo(
    () => data.assets.filter((asset) => asset.companyId === companyId),
    [data.assets, companyId],
  );
  const onlineCount = assets.filter((asset) => data.statuses[asset.id]?.state === 'online').length;
  const monitoredCount = assets.filter(
    (asset) =>
      asset.type === 'website' ||
      (asset.type === 'discord' && (IS_TRAY ? Boolean(botHints[asset.id]) : asset.hasSecret)),
  ).length;
  const health = useMemo(() => companyHealth(assets, data.statuses), [assets, data.statuses]);

  const openTasks = useMemo(
    () =>
      data.tasks
        .filter((task) => task.companyId === companyId && !task.done)
        .sort((a, b) => {
          const aDue = a.due ? Date.parse(a.due) : Number.MAX_SAFE_INTEGER;
          const bDue = b.due ? Date.parse(b.due) : Number.MAX_SAFE_INTEGER;
          return aDue - bDue;
        }),
    [data.tasks, companyId],
  );
  const overdueCount = openTasks.filter((task) => task.due && task.due < today).length;

  const monthEntries = useMemo(
    () =>
      data.finance.filter(
        (entry) => entry.companyId === companyId && entry.date.startsWith(monthKey),
      ),
    [data.finance, companyId, monthKey],
  );
  const income = monthEntries
    .filter((entry) => entry.kind === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = monthEntries
    .filter((entry) => entry.kind === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const net = income - expense;
  const targetPct = company?.monthlyTarget
    ? Math.max(0, Math.round((net / company.monthlyTarget) * 100))
    : null;

  const recentEntries = useMemo(
    () =>
      data.finance
        .filter((entry) => entry.companyId === companyId)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 4),
    [data.finance, companyId],
  );

  const notes = useMemo(
    () =>
      data.notes
        .filter((note) => note.companyId === companyId)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        }),
    [data.notes, companyId],
  );

  if (!company) {
    return (
      <div className="card">
        <EmptyState
          icon={<ArrowLeft size={20} />}
          title={t('Şirket bulunamadı')}
          description={t('Bu şirket silinmiş olabilir. Portföye dönüp tekrar seç.')}
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate('companies')}>
              {t('Şirketlere dön')}
            </button>
          }
        />
      </div>
    );
  }

  const toggleTask = async (task: Task) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);
    await actions.updateTask({ id: task.id, done: true });
    setTogglingTaskId(null);
  };

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('companies')}>
        <ArrowLeft size={14} /> {t('Tüm şirketler')}
      </button>

      <div className="company-hero" style={{ ['--company' as string]: company.color }}>
        <div className="company-hero-glow" />
        <div className="company-hero-main">
          <CompanyAvatar company={company} size="xl" />
          <div className="company-hero-text">
            <div className="company-hero-eyebrow">
              <span className="eyebrow">
                {t('{category} · {count} servis', {
                  category: t(COMPANY_CATEGORY_LABEL[company.category]),
                  count: assets.length,
                })}
              </span>
              <StatusPill
                state={COMPANY_HEALTH_STATE[health.state]}
                label={t(COMPANY_HEALTH_LABEL[health.state])}
              />
              {company.status !== 'active' ? (
                <span className={`company-status status-${company.status}`}>
                  {t(COMPANY_STATUS_LABEL[company.status])}
                </span>
              ) : null}
            </div>
            <h1>{company.name}</h1>
            <p>{company.description || t('Bu şirket için henüz açıklama eklenmedi.')}</p>
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setCompanyModalOpen(true)}>
            <Pencil size={14} /> {t('Düzenle')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingAsset(null);
              setAssetModalOpen(true);
            }}
          >
            <Plus size={15} /> {t('Servis bağla')}
          </button>
        </div>
      </div>

      <div className="stat-strip company-stat-strip">
        <div className="stat-cell">
          <span className="stat-label">{t('Servisler')}</span>
          <strong>{assets.length}</strong>
          <span className="stat-note">
            {IS_WEB && !IS_TRAY
              ? t('Yerel envanter')
              : monitoredCount
                ? t('{online}/{monitored} doğrulandı', { online: onlineCount, monitored: monitoredCount })
                : IS_TRAY && assets.length
                  ? t('İlk kontrol bekleniyor')
                  : t('izleme yok')}
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">{t('Açık görev')}</span>
          <strong>{openTasks.length}</strong>
          <span className="stat-note">
            {overdueCount ? t('{count} geciken', { count: overdueCount }) : t('geciken yok')}
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">{t('Bu ay net')}</span>
          <strong className={net < 0 ? 'text-danger' : ''}>
            {monthEntries.length ? formatMoney(net, currency) : '—'}
          </strong>
          <span className="stat-note">
            {monthEntries.length
              ? t('{income} gelir · {expense} gider', {
                  income: formatMoney(income, currency),
                  expense: formatMoney(expense, currency),
                })
              : t('kayıt yok')}
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">{t('Aylık hedef')}</span>
          <strong className={targetPct !== null && targetPct >= 100 ? 'text-income' : ''}>
            {targetPct !== null ? `%${targetPct}` : '—'}
          </strong>
          <span className="stat-note">
            {company.monthlyTarget
              ? `${formatMoney(net, currency)} / ${formatMoney(company.monthlyTarget, currency)}`
              : t('hedef belirlenmedi')}
          </span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{t('Servisler')}</h2>
              <p>
                {IS_TRAY
                  ? t('Bot ve site durumları arka planda izlenir.')
                  : IS_WEB
                    ? t('Servis envanteri ve hızlı erişim.')
                    : t('Gerçek API kontrolleri ve son durum.')}
              </p>
            </div>
            <div className="card-header-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setEditingAsset(null);
                  setAssetModalOpen(true);
                }}
                aria-label={t('Servis bağla')}
              >
                <Plus size={15} />
              </button>
              <button type="button" className="text-link" onClick={() => navigate('services')}>
                {t('Tümü')}
              </button>
            </div>
          </div>
          {assets.length === 0 ? (
            <EmptyState
              compact
              icon={<Cable size={18} />}
              title={t('Servis bağlanmadı')}
              description={
                IS_TRAY
                  ? t('Bu şirketin botunu, panelini veya sitesini bağla; durum arka planda izlenir.')
                  : IS_WEB
                    ? t('Bu şirketin botunu, panelini veya sitesini envantere ekle.')
                    : t('Bu şirketin botunu, panelini veya sitesini bağlayarak canlı veri almaya başla.')
              }
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingAsset(null);
                    setAssetModalOpen(true);
                  }}
                >
                  {t('Servis bağla')}
                </button>
              }
            />
          ) : (
            <div className="service-list">
              {assets.map((asset) => {
                const status = data.statuses[asset.id];
                const state = status?.state ?? 'unchecked';
                const hasSecret =
                  asset.type === 'discord' && IS_WEB
                    ? Boolean(botHints[asset.id])
                    : asset.hasSecret;
                return (
                  <div className="service-row service-row-static" key={asset.id}>
                    <span className={`service-state-dot state-${state}`} />
                    <ServiceAvatar asset={asset} company={company} />
                    <span className="service-main">
                      <span className="service-name">{asset.name}</span>
                      <span className="service-meta">
                        {serviceSummary(asset, status, t, hasSecret)}
                      </span>
                    </span>
                    <span className="service-side">
                      <StatusPill
                        state={state}
                        label={t(serviceStateLabel(asset, state, hasSecret))}
                        subtle
                      />
                      <span className="service-time">{status ? relativeTime(status.checkedAt) : '—'}</span>
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setEditingAsset(asset);
                        setAssetModalOpen(true);
                      }}
                      aria-label={t('{name} servisini düzenle', { name: asset.name })}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span-5">
          <div className="card-header">
            <div>
              <h2>{t('Hızlı erişim')}</h2>
              <p>{t('Paneller ve yönetim ekranları.')}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setEditingLink(null);
                setLinkModalOpen(true);
              }}
              aria-label={t('Bağlantı ekle')}
            >
              <Plus size={15} />
            </button>
          </div>
          {company.links.length === 0 ? (
            <EmptyState
              compact
              icon={<Link2 size={18} />}
              title={t('Bağlantı yok')}
              description={t('Discord paneli, hosting veya site yönetimi gibi sık açtığın adresleri ekle.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingLink(null);
                    setLinkModalOpen(true);
                  }}
                >
                  {t('Bağlantı ekle')}
                </button>
              }
            />
          ) : (
            <div className="link-list">
              {company.links.map((link) => (
                <div className="link-row link-row-static" key={link.id}>
                  <button
                    type="button"
                    className="link-open"
                    onClick={() => void actions.openExternal(link.url)}
                    title={link.url}
                  >
                    <LinkAvatar link={link} company={company} locale={locale} />
                    <span className="link-main">
                      <span className="link-label">{link.label}</span>
                      <span className="link-company">{new URL(link.url).hostname.replace(/^www\./, '')}</span>
                    </span>
                    <ArrowUpRight size={14} className="link-arrow" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setEditingLink(link);
                      setLinkModalOpen(true);
                    }}
                    aria-label={t('{name} bağlantısını düzenle', { name: link.label })}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {!IS_WEB ? <YoutubeCompanyCard company={company} navigate={navigate} /> : null}

        <section className="card span-7">
          <div className="card-header">
            <div>
              <h2>{t('Finans')}</h2>
              <p>{t('Bu ayın özeti ve son kayıtlar.')}</p>
            </div>
            <div className="card-header-actions">
              <button type="button" className="icon-btn" onClick={() => setEntryModalOpen(true)} aria-label={t('Finans kaydı ekle')}>
                <Plus size={15} />
              </button>
              <button type="button" className="text-link" onClick={() => navigate('finance')}>
                {t('Finans')}
              </button>
            </div>
          </div>
          <div className="finance-summary finance-summary-tight">
            <div>
              <span className="finance-label">{t('Bu ay net')}</span>
              <strong className={`finance-net ${net < 0 ? 'negative' : ''}`}>
                {monthEntries.length ? formatMoney(net, currency) : '—'}
              </strong>
            </div>
            <div className="finance-split">
              <span><i className="dot-income" /> {t('Gelir')} <b>{formatMoney(income, currency)}</b></span>
              <span><i className="dot-expense" /> {t('Gider')} <b>{formatMoney(expense, currency)}</b></span>
            </div>
          </div>
          {company.monthlyTarget ? (
            <div className="target-progress">
              <div className="target-progress-head">
                <span>{t('Hedef ilerlemesi')}</span>
                <span className={targetPct !== null && targetPct >= 100 ? 'text-income' : ''}>
                  %{targetPct ?? 0}
                </span>
              </div>
              <div className="target-progress-track">
                <span
                  style={{ width: `${Math.min(100, Math.max(0, targetPct ?? 0))}%` }}
                />
              </div>
            </div>
          ) : null}
          {recentEntries.length === 0 ? (
            <EmptyState
              compact
              icon={<Wallet size={18} />}
              title={t('Kayıt yok')}
              description={t('Bu şirketin ilk gelir veya gider kaydını ekle.')}
              action={
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEntryModalOpen(true)}>
                  {t('Kayıt ekle')}
                </button>
              }
            />
          ) : (
            <div className="entry-list">
              {recentEntries.map((entry) => (
                <div className="entry-row" key={entry.id}>
                  <span className={`entry-icon ${entry.kind}`}>
                    {entry.kind === 'income' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                  </span>
                  <span className="entry-main">
                    <span className="entry-title">{entry.category || t('Genel')}</span>
                    <span className="entry-meta">
                      {formatDate(entry.date)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </span>
                  </span>
                  <span className={`entry-amount ${entry.kind}`}>
                    {entry.kind === 'income' ? '+' : '−'}
                    {formatMoney(entry.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card span-5">
          <div className="card-header">
            <div>
              <h2>{t('Görevler')}</h2>
              <p>{overdueCount ? t('{count} geciken görev.', { count: overdueCount }) : t('Bu şirketin açık işleri.')}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
              aria-label={t('Görev ekle')}
            >
              <Plus size={15} />
            </button>
          </div>
          {openTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<ListChecks size={18} />}
              title={t('Açık görev yok')}
              description={t('Yapılacakları görevlere ayır; ilerlemeyi bu panelden takip et.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                >
                  {t('Görev ekle')}
                </button>
              }
            />
          ) : (
            <div className="task-list">
              {openTasks.slice(0, 6).map((task) => {
                const due = dueLabel(task.due);
                return (
                  <div className="task-row" key={task.id}>
                    <button
                      type="button"
                      className={`task-check ${togglingTaskId === task.id ? 'pending' : ''}`}
                      onClick={() => void toggleTask(task)}
                      aria-label={t('Görevi tamamla')}
                    />
                    <button
                      type="button"
                      className="task-main"
                      onClick={() => {
                        setEditingTask(task);
                        setTaskModalOpen(true);
                      }}
                    >
                      <span className="task-title">{task.title}</span>
                      <span className="task-meta">
                        <span className={`priority-dot priority-dot-${task.priority}`} />
                        {due ? <span className={`due due-${due.tone}`}>{due.text}</span> : <span className="due due-none">{t('Tarihsiz')}</span>}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span-12">
          <div className="card-header">
            <div>
              <h2>{t('Notlar')}</h2>
              <p>{t('Bu şirkete bağlı fikirler ve kararlar.')}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setEditingNote(null);
                setNoteModalOpen(true);
              }}
              aria-label={t('Not ekle')}
            >
              <Plus size={15} />
            </button>
          </div>
          {notes.length === 0 ? (
            <EmptyState
              compact
              icon={<FileText size={18} />}
              title={t('Not yok')}
              description={t('Kararları, fikirleri ve operasyon detaylarını not olarak sakla.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteModalOpen(true);
                  }}
                >
                  {t('Not ekle')}
                </button>
              }
            />
          ) : (
            <div className="note-grid">
              {notes.slice(0, 6).map((note) => (
                <button
                  type="button"
                  className="note-tile"
                  key={note.id}
                  onClick={() => {
                    setEditingNote(note);
                    setNoteModalOpen(true);
                  }}
                >
                  <span className="note-tile-top">
                    <strong>{note.title}</strong>
                    {note.pinned ? <Pin size={12} className="pin-indicator" /> : null}
                  </span>
                  <span className="note-tile-body">{note.body || t('İçerik yok.')}</span>
                  <span className="note-tile-meta">
                    <Check size={11} /> {relativeTime(note.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <CompanyModal open={companyModalOpen} onClose={() => setCompanyModalOpen(false)} company={company} />
      <AssetModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        asset={editingAsset}
        defaultCompanyId={company.id}
      />
      <LinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        company={company}
        link={editingLink}
      />
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
        defaultCompanyId={company.id}
      />
      <NoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        note={editingNote}
        defaultCompanyId={company.id}
      />
      <EntryModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        defaultCompanyId={company.id}
      />
    </>
  );
}
