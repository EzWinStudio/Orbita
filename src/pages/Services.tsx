import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Cable,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Globe2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { WebNotice } from '../web/WebNotice';
import { IS_TRAY, IS_WEB } from '../lib/runtime';
import { requestTrayCheck } from '../web/trayBridge';
import { StatusPill } from '../components/StatusPill';
import { AssetIcon } from '../components/AssetIcon';
import { CompanyChip } from '../components/CompanyChip';
import { Sparkline } from '../components/Sparkline';
import { EmptyState } from '../components/EmptyState';
import { AssetModal } from '../modals/AssetModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { ASSET_TYPE_LABEL } from '../constants';
import { localizeStatusText, serviceStateLabel, serviceSummary } from '../lib/status';
import { useBotHints } from '../web/botSecrets';
import type { Asset, AssetType, ServiceState } from '../types';
import type { TranslationKey } from '../i18n/core';
import type { NavIntent, Page } from '../nav';
import {
  durationShort,
  percent,
  relativeTime,
  successRate,
  sslInfo,
  formatNumber,
} from '../lib/format';

interface ServicesProps {
  navigate: (page: Page, companyId?: string | null) => void;
  intent: NavIntent | null;
  onIntentHandled: () => void;
}

const SEVERITY: Record<ServiceState, number> = {
  offline: 0,
  degraded: 1,
  unchecked: 2,
  online: 3,
};

function serverState(state: string): { state: ServiceState; label: TranslationKey } {
  if (state === 'running') return { state: 'online', label: 'Çalışıyor' };
  if (state === 'starting') return { state: 'degraded', label: 'Başlıyor' };
  if (state === 'stopping') return { state: 'degraded', label: 'Duruyor' };
  if (state === 'offline' || state === 'stopped') return { state: 'offline', label: 'Durdu' };
  return { state: 'unchecked', label: 'Bilinmiyor' };
}

export function Services({ navigate, intent, onIntentHandled }: ServicesProps) {
  const data = useAppData();
  const { actions, toast, confirm } = useApp();
  const { t, locale } = useI18n();
  const botHints = useBotHints();
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AssetType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (intent?.kind === 'asset') {
      setEditing(null);
      setModalOpen(true);
      onIntentHandled();
    }
  }, [intent, onIntentHandled]);

  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );

  const statusOf = (asset: Asset): ServiceState => data.statuses[asset.id]?.state ?? 'unchecked';

  const filtered = useMemo(
    () =>
      [...data.assets]
        .filter((asset) => companyFilter === 'all' || asset.companyId === companyFilter)
        .filter((asset) => typeFilter === 'all' || asset.type === typeFilter)
        .sort((a, b) => {
          const diff = SEVERITY[statusOf(a)] - SEVERITY[statusOf(b)];
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name, locale);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.assets, data.statuses, companyFilter, typeFilter, locale],
  );

  const stats = useMemo(() => {
    const values = data.assets.map((asset) => statusOf(asset));
    return {
      total: values.length,
      online: values.filter((state) => state === 'online').length,
      problems: values.filter((state) => state === 'offline' || state === 'degraded').length,
      waiting: values.filter((state) => state === 'unchecked').length,
    };
  }, [data.assets, data.statuses]);

  const counts = useMemo(() => {
    return {
      discord: data.assets.filter((asset) => asset.type === 'discord').length,
      pterodactyl: data.assets.filter((asset) => asset.type === 'pterodactyl').length,
      website: data.assets.filter((asset) => asset.type === 'website').length,
    };
  }, [data.assets]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setModalOpen(true);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    if (IS_TRAY) {
      requestTrayCheck('services');
      window.setTimeout(() => setRefreshing(false), 3000);
      return;
    }
    await actions.refreshMonitor();
    setRefreshing(false);
  };

  const test = async (asset: Asset) => {
    if (testingId) return;
    setTestingId(asset.id);
    const result = await actions.testAsset({
      type: asset.type,
      config: asset.config,
      assetId: asset.id,
    });
    setTestingId(null);
    if (result) {
      toast(result.ok ? 'success' : 'error', `${asset.name} · ${result.message}`);
    }
  };

  const remove = async (asset: Asset) => {
    const sure = await confirm({
      title: t('Servis kaldırılsın mı?'),
      message: t('“{name}” izleme listesinden ve şifreli anahtar deposundan kaldırılacak. Geçmiş durum verisi de silinir.', {
        name: asset.name,
      }),
      confirmLabel: t('Servisi kaldır'),
    });
    if (!sure) return;
    setDeletingId(asset.id);
    await actions.deleteAsset(asset.id);
    setDeletingId(null);
  };

  const defaultCompanyId =
    companyFilter !== 'all' ? companyFilter : data.companies[0]?.id ?? null;

  return (
    <>
      <PageHeader
        eyebrow={t('Kontrol')}
        title={t('Servisler')}
        subtitle={
          IS_TRAY
            ? t('Site ve bot sağlığı arka planda izlenir.')
            : IS_WEB
              ? t('Servisler envanter olarak listelenir; canlı API kontrolü yapılmaz.')
              : t('Botlar, paneller ve siteler; gerçek API yanıtlarıyla tek listede.')
        }
        actions={
          <>
            {!IS_WEB || IS_TRAY ? (
              <button type="button" className="btn btn-ghost" onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
                {refreshing ? t('Kontrol ediliyor…') : t('Tümünü yenile')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
              disabled={data.companies.length === 0}
            >
              <Plus size={15} /> {t('Servis bağla')}
            </button>
          </>
        }
      />

      {IS_WEB ? <WebNotice /> : null}

      <div className="stat-strip">
        <div className="stat-cell">
          <span className="stat-label">{t('Toplam servis')}</span>
          <strong>{stats.total}</strong>
          <span className="stat-icon"><Cable size={15} /></span>
        </div>
        {IS_WEB && !IS_TRAY ? (
          <>
            <div className="stat-cell">
              <span className="stat-label">{t('Site')}</span>
              <strong>{counts.website}</strong>
              <span className="stat-icon"><Globe2 size={15} /></span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">{t('Bot')}</span>
              <strong>{counts.discord}</strong>
              <span className="stat-icon"><Bot size={15} /></span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">{t('Panel')}</span>
              <strong>{counts.pterodactyl}</strong>
              <span className="stat-icon"><Server size={15} /></span>
            </div>
          </>
        ) : (
          <>
            <div className="stat-cell stat-online">
              <span className="stat-label">{t('Doğrulandı')}</span>
              <strong>{stats.online}</strong>
              <span className="stat-icon"><Activity size={15} /></span>
            </div>
            <div className={`stat-cell ${stats.problems ? 'stat-warning' : ''}`}>
              <span className="stat-label">{t('Sorunlu')}</span>
              <strong>{stats.problems}</strong>
              <span className="stat-icon"><TriangleAlert size={15} /></span>
            </div>
            <div className="stat-cell">
              <span className="stat-label">{t('Bekleyen')}</span>
              <strong>{stats.waiting}</strong>
              <span className="stat-icon"><CircleAlert size={15} /></span>
            </div>
          </>
        )}
      </div>

      {data.assets.length === 0 ? (
        <div className="card">
          {data.companies.length === 0 ? (
            <EmptyState
              icon={<Server size={20} />}
              title={t('Önce bir şirket ekle')}
              description={t('Servisler bir şirkete bağlanır. İlk şirketini oluşturduktan sonra Discord, Pterodactyl veya site izleme ekleyebilirsin.')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => navigate('companies')}>
                  {t('Şirketler’e git')}
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<Cable size={20} />}
              title={t('Henüz bağlı servis yok')}
              description={t('Gerçek API bağlantıları kur; kontrol döngüsü ilk veriyi saniyeler içinde getirir.')}
              action={
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <Plus size={15} /> {t('Servis bağla')}
                </button>
              }
            />
          )}
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <div className="filter-chips">
              <button
                type="button"
                className={`chip ${companyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCompanyFilter('all')}
              >
                {t('Tüm şirketler')}
                <span className="chip-count">{data.assets.length}</span>
              </button>
              {data.companies.map((company) => {
                const count = data.assets.filter((asset) => asset.companyId === company.id).length;
                return (
                  <button
                    type="button"
                    key={company.id}
                    className={`chip ${companyFilter === company.id ? 'active' : ''}`}
                    onClick={() => setCompanyFilter(company.id)}
                  >
                    <span className="company-dot" style={{ background: company.color }} />
                    {company.name}
                    <span className="chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="segmented">
              <button
                type="button"
                className={`segment ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                {t('Tümü')}
              </button>
              <button
                type="button"
                className={`segment ${typeFilter === 'discord' ? 'active' : ''}`}
                onClick={() => setTypeFilter('discord')}
              >
                {t('Bot')} {counts.discord}
              </button>
              <button
                type="button"
                className={`segment ${typeFilter === 'pterodactyl' ? 'active' : ''}`}
                onClick={() => setTypeFilter('pterodactyl')}
              >
                {t('Panel')} {counts.pterodactyl}
              </button>
              <button
                type="button"
                className={`segment ${typeFilter === 'website' ? 'active' : ''}`}
                onClick={() => setTypeFilter('website')}
              >
                {t('Site')} {counts.website}
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                compact
                icon={<Cable size={18} />}
                title={t('Bu filtrede servis yok')}
                description={t('Filtreleri değiştir veya yeni bir servis bağla.')}
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={openCreate}>
                    {t('Servis bağla')}
                  </button>
                }
              />
            </div>
          ) : (
            <div className="asset-list">
              {filtered.map((asset) => {
                const status = data.statuses[asset.id];
                const state = statusOf(asset);
                const company = companyById.get(asset.companyId);
                const expanded = expandedId === asset.id;
                const hasSecret =
                  asset.type === 'discord' && IS_WEB
                    ? Boolean(botHints[asset.id])
                    : asset.hasSecret;
                const needsSecret = asset.type !== 'website' && !hasSecret;
                const website = asset.type === 'website' ? status?.website : null;
                const ssl = website ? sslInfo(website.sslExpiresAt) : null;
                const rate = website ? successRate(website.history) : null;

                return (
                  <article className={`asset-card ${expanded ? 'open' : ''}`} key={asset.id}>
                    <button
                      type="button"
                      className="asset-row"
                      onClick={() => setExpandedId(expanded ? null : asset.id)}
                    >
                      <span
                        className="asset-icon"
                        style={{
                          background: `${company?.color ?? '#3ef2b5'}14`,
                          color: company?.color ?? '#3ef2b5',
                        }}
                      >
                        <AssetIcon type={asset.type} size={17} />
                      </span>
                      <span className="asset-identity">
                        <span className="asset-name-line">
                          <span className="asset-name">{asset.name}</span>
                          <span className="type-chip">{t(ASSET_TYPE_LABEL[asset.type])}</span>
                        </span>
                        <span className="asset-sub">
                          <CompanyChip company={company} />
                          <span className="meta-sep">·</span>
                          <span className="asset-target">
                            {asset.config.url ?? asset.config.baseUrl ?? t('Bot API')}
                          </span>
                        </span>
                      </span>
                      <span className="asset-status">
                        <StatusPill
                          state={state}
                          label={t(serviceStateLabel(asset, state, hasSecret))}
                        />
                        {status ? <span className="asset-latency">{status.latencyMs != null ? `${status.latencyMs} ms` : ''}</span> : null}
                      </span>
                      <span className="asset-summary">
                        {serviceSummary(asset, status, t, hasSecret)}
                      </span>
                      <span className="asset-time">{status ? relativeTime(status.checkedAt) : '—'}</span>
                      <ChevronDown size={15} className={`asset-chevron ${expanded ? 'open' : ''}`} />
                    </button>

                    {expanded ? (
                      <div className="asset-detail">
                        {status?.error ? (
                          <div className="alert alert-warning">
                            <TriangleAlert size={15} />
                            <span>{localizeStatusText(status.error, t)}</span>
                          </div>
                        ) : null}

                        {needsSecret ? (
                          <div className="alert alert-info">
                            <CircleAlert size={15} />
                            <span>
                              {asset.type === 'discord' && IS_TRAY
                                ? t('Bu bot için kayıtlı token yok. Servisi düzenleyerek bağla.')
                                : t('Bu servis için şifreli bir API anahtarı kayıtlı değil. Servisi düzenleyerek anahtar ekle.')}
                            </span>
                          </div>
                        ) : null}

                        {asset.type === 'discord' && status?.state === 'online' ? (
                          <div className="alert alert-info">
                            <CircleAlert size={15} />
                            <span>{t('Discord botunun çevrimiçi durumu API ile doğrulanamaz; burada bot API erişimi doğrulanır.')}</span>
                          </div>
                        ) : null}

                        {asset.type === 'website' && website ? (
                          <>
                            <div className="metric-grid">
                              <div className="metric">
                                <span>{t('HTTP kodu')}</span>
                                <strong>{website.statusCode ?? '—'}</strong>
                              </div>
                              <div className="metric">
                                <span>{t('Yanıt süresi')}</span>
                                <strong>{status?.latencyMs != null ? `${status.latencyMs} ms` : '—'}</strong>
                              </div>
                              <div className="metric">
                                <span>{t('SSL sertifikası')}</span>
                                <strong className={ssl?.tone === 'warn' || ssl?.tone === 'bad' ? 'text-warning' : ''}>
                                  {ssl?.text ?? '—'}
                                </strong>
                              </div>
                              <div className="metric">
                                <span>{t('Son {count} kontrol', { count: website.history.length })}</span>
                                <strong>{rate !== null ? t('{rate}% başarılı', { rate }) : '—'}</strong>
                              </div>
                            </div>
                            <div className="sparkline-panel">
                              <span className="sparkline-label">{t('Yanıt süresi geçmişi')}</span>
                              <Sparkline history={website.history} />
                            </div>
                            {asset.config.url ? (
                              <button
                                type="button"
                                className="endpoint-row"
                                onClick={() => void actions.openExternal(asset.config.url!)}
                              >
                                <ExternalLink size={14} />
                                <span>{asset.config.url}</span>
                              </button>
                            ) : null}
                          </>
                        ) : null}

                        {asset.type === 'discord' && status?.discord ? (
                          <>
                            <div className="identity-card">
                              <span className="identity-avatar">
                                {status.discord.username?.slice(0, 1).toLocaleUpperCase(locale) ?? 'B'}
                              </span>
                              <div>
                                <strong>{status.discord.username}</strong>
                                <span>{t('Bot kimliği · {id}', { id: status.discord.botId })}</span>
                              </div>
                              <span className="identity-stat">
                                <strong>{status.discord.guildCount ?? status.discord.guilds.length}</strong>
                                <span>{t('sunucu')}</span>
                              </span>
                              <span className="identity-stat">
                                <strong>{status.latencyMs ?? '—'} ms</strong>
                                <span>{t('API gecikmesi')}</span>
                              </span>
                            </div>
                            {status.discord.guilds.length > 0 ? (
                              <div className="guild-wrap">
                                <span className="sparkline-label">{t('Botun bulunduğu sunucular')}</span>
                                <div className="guild-chips">
                                  {status.discord.guilds.slice(0, 16).map((guild) => (
                                    <span className="guild-chip" key={guild.id}>
                                      {guild.name}
                                    </span>
                                  ))}
                                  {status.discord.guilds.length > 16 ? (
                                    <span className="guild-chip guild-more">
                                      +{status.discord.guilds.length - 16}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <p className="muted-line">{t('Bot henüz bir sunucuda bulunmuyor.')}</p>
                            )}
                          </>
                        ) : null}

                        {asset.type === 'pterodactyl' && status?.pterodactyl ? (
                          <>
                            <div className="identity-card">
                              <span className="identity-avatar">P</span>
                              <div>
                                <strong>{status.pterodactyl.account ?? t('Pterodactyl hesabı')}</strong>
                                <span>{asset.config.baseUrl}</span>
                              </div>
                              <span className="identity-stat">
                                <strong>{status.pterodactyl.total}</strong>
                                <span>{t('toplam sunucu')}</span>
                              </span>
                              <span className="identity-stat">
                                <strong>
                                  {status.pterodactyl.servers.filter((server) => server.state === 'running').length}
                                </strong>
                                <span>{t('çalışıyor')}</span>
                              </span>
                            </div>
                            <div className="panel-table">
                              <div className="panel-table-head">
                                <span>{t('Sunucu')}</span>
                                <span>{t('Durum')}</span>
                                <span>CPU</span>
                                <span>RAM</span>
                                <span>Disk</span>
                                <span>{t('Süre')}</span>
                              </div>
                              {status.pterodactyl.servers.map((server) => {
                                const stateMeta = serverState(server.state);
                                const memPct = percent(server.memoryMb, server.memoryLimitMb);
                                const diskPct = percent(server.diskMb, server.diskLimitMb);
                                return (
                                  <div className="panel-table-row" key={server.id}>
                                    <span className="panel-server-name">{server.name}</span>
                                    <span><StatusPill state={stateMeta.state} label={t(stateMeta.label)} subtle /></span>
                                    <span className="mono-cell">{server.cpuPercent != null ? `${server.cpuPercent}%` : '—'}</span>
                                    <span className="mono-cell">
                                      {server.memoryMb != null ? `${formatNumber(server.memoryMb)} MB` : '—'}
                                      {memPct !== null ? <i className="mini-bar"><i style={{ width: `${memPct}%` }} /></i> : null}
                                    </span>
                                    <span className="mono-cell">
                                      {server.diskMb != null ? `${formatNumber(server.diskMb)} MB` : '—'}
                                      {diskPct !== null ? <i className="mini-bar"><i style={{ width: `${diskPct}%` }} /></i> : null}
                                    </span>
                                    <span className="mono-cell">{durationShort(server.uptimeMs)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : null}

                        {!status ? (
                          <p className="muted-line">
                            {IS_TRAY
                              ? needsSecret
                                ? t('Bot bağlantısı bekliyor')
                                : t('İlk kontrol bekleniyor')
                              : IS_WEB
                                ? t('Canlı izleme tarayıcı sürümünde kapalı.')
                                : t('Henüz canlı veri yok. {next} otomatik olarak çalışacak.', {
                                    next: needsSecret
                                      ? t('Anahtar ekledikten sonra')
                                      : t('İlk kontrol'),
                                  })}
                          </p>
                        ) : null}

                        <div className="asset-actions">
                          <span className="asset-lastcheck">
                            {IS_TRAY && status
                              ? t('Son kontrol: {time}', { time: relativeTime(status.checkedAt) })
                              : IS_WEB
                                ? t('Yerel envanter')
                                : t('Son kontrol: {time}', {
                                    time: status ? relativeTime(status.checkedAt) : '—',
                                  })}
                          </span>
                          <div className="asset-actions-buttons">
                            {!IS_WEB ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void test(asset)}
                                disabled={testingId === asset.id || needsSecret}
                                title={needsSecret ? t('Önce API anahtarı ekle') : t('Kayıtlı bilgilerle test et')}
                              >
                                {testingId === asset.id ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
                                {t('Test et')}
                              </button>
                            ) : null}
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(asset)}>
                              <Pencil size={14} /> {t('Düzenle')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => void remove(asset)}
                              disabled={deletingId === asset.id}
                            >
                              <Trash2 size={14} /> {t('Kaldır')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <AssetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        asset={editing}
        defaultCompanyId={defaultCompanyId}
      />
    </>
  );
}
