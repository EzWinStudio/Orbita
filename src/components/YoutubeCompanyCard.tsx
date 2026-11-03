import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  Eye,
  KeyRound,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import type { Company } from '../types';
import type { Page } from '../nav';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import { translateMessage } from '../i18n/core';
import { relativeTime } from '../lib/format';
import {
  compactNumber,
  fullNumber,
  youtubeChannelUrl,
  youtubeCommentUrl,
  youtubeStudioUrl,
  youtubeVideoUrl,
} from '../lib/youtube';
import { YoutubeIcon } from './YoutubeIcon';

interface YoutubeCompanyCardProps {
  company: Company;
  navigate: (page: Page) => void;
}

export function YoutubeCompanyCard({ company, navigate }: YoutubeCompanyCardProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t, locale, language } = useI18n();
  const [url, setUrl] = useState(
    () =>
      company.links.find((link) =>
        /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(link.url),
      )?.url ?? '',
  );
  const [binding, setBinding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const defaultKey = data.youtubeKeys.find((key) => key.isDefault) ?? data.youtubeKeys[0] ?? null;
  const [keyId, setKeyId] = useState(defaultKey?.id ?? '');
  const hasYoutubeKey = data.youtubeKeys.some((key) => key.hasKey);

  useEffect(() => {
    if (!keyId && defaultKey) setKeyId(defaultKey.id);
  }, [defaultKey, keyId]);

  const channel = data.youtubeChannels.find((item) => item.companyId === company.id) ?? null;
  const channelKey = channel
    ? data.youtubeKeys.find((key) => key.id === channel.keyId) ?? null
    : null;
  const channelKeyReady = Boolean(channelKey?.hasKey);
  const channelEvents = useMemo(
    () =>
      channel
        ? data.youtubeEvents.filter((event) => event.channelId === channel.channelId)
        : [],
    [channel, data.youtubeEvents],
  );
  const events = channelEvents.slice(0, 8);

  const weekStart = Date.now() - 7 * 86400000;
  const weekEvents = channelEvents.filter((event) => event.at >= weekStart);
  const newSubscribers = weekEvents
    .filter((event) => event.kind === 'subscriber')
    .reduce((sum, event) => sum + (event.count ?? 0), 0);
  const newComments = weekEvents.filter((event) => event.kind === 'comment').length;
  const commentLikes = channel
    ? channel.recentComments.reduce((sum, comment) => sum + (comment.likeCount ?? 0), 0)
    : 0;

  const bind = async () => {
    const value = url.trim();
    if (!value || binding) return;
    setBinding(true);
    const ok = await actions.addYoutubeChannel(company.id, value, keyId || undefined);
    if (ok) setUrl('');
    setBinding(false);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await actions.refreshYoutube();
    setRefreshing(false);
  };

  const unbind = async () => {
    if (!channel || unbinding) return;
    const ok = await confirm({
      title: t('YouTube kanalı kaldırılsın mı?'),
      message: t(
        '{name} kanalı ve bu cihazdaki YouTube hareketleri silinir. Kanalın YouTube’da kalır.',
        { name: channel.title },
      ),
      confirmLabel: t('Kanalı kaldır'),
    });
    if (!ok) return;
    setUnbinding(true);
    await actions.removeYoutubeChannel(channel.id);
    setUnbinding(false);
  };

  if (!channel) {
    return (
      <section className="card span-12 youtube-card youtube-card-empty">
        <div className="card-header">
          <div>
            <h2 className="yt-heading">
              <span className="yt-heading-icon">
                <YoutubeIcon size={16} />
              </span>
              {t('YouTube')}
            </h2>
            <p>{t('Kanalını bağla; abone artışı ve yeni yorumlar burada görünsün.')}</p>
          </div>
        </div>

        {!hasYoutubeKey ? (
          <div className="yt-setup">
            <span className="yt-setup-icon">
              <KeyRound size={18} />
            </span>
            <div className="yt-setup-text">
              <strong>{t('YouTube API anahtarı gerekli')}</strong>
              <span>
                {t(
                  'Google Cloud’dan bir kez YouTube Data API v3 anahtarı oluştur. Anahtar bu cihazda DPAPI ile şifrelenir; yalnızca Google’ın YouTube API isteklerinde kullanılır.',
                )}
              </span>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('settings')}>
              <KeyRound size={14} /> {t('Ayarları aç')}
            </button>
          </div>
        ) : (
          <>
            <form
              className="yt-bind-form"
              onSubmit={(event) => {
                event.preventDefault();
                void bind();
              }}
            >
              <input
                className="input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/@kanal"
                aria-label={t('YouTube kanal bağlantısı')}
                spellCheck={false}
                disabled={binding}
              />
              <button type="submit" className="btn btn-primary" disabled={!url.trim() || binding}>
                {binding ? (
                  <RefreshCw size={14} className="spin" />
                ) : (
                  <YoutubeIcon size={15} />
                )}
                {binding ? t('Kanal bağlanıyor…') : t('Kanalı bağla')}
              </button>
            </form>
            {data.youtubeKeys.length > 1 ? (
              <label className="yt-bind-key">
                <span>{t('Kanal anahtarı')}</span>
                <select
                  className="input select select-compact"
                  value={keyId}
                  onChange={(event) => setKeyId(event.target.value)}
                  aria-label={t('Kanal anahtarı')}
                  disabled={binding}
                >
                  {data.youtubeKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="yt-fineprint">
              {t(
                'Kanal herkese açık olmalı. @kanaladı veya youtube.com kanal bağlantısı yeterli. Yorumlar ve abone sayısı yaklaşık 5–10 dakikada bir yenilenir.',
              )}
            </p>
          </>
        )}
      </section>
    );
  }

  const channelLink = youtubeChannelUrl(channel);
  const lastError = channel.lastError
    ? translateMessage(language, channel.lastError)
    : null;
  const commentsError = channel.commentsError
    ? translateMessage(language, channel.commentsError)
    : null;

  return (
    <section className="card span-12 youtube-card">
      <div className="yt-top">
        <div className="yt-profile">
          <span
            className="yt-avatar"
            style={{ background: `${company.color}22`, color: company.color }}
          >
            {channel.avatar ? (
              <img src={channel.avatar} alt="" />
            ) : (
              channel.title.trim()[0]?.toLocaleUpperCase(locale) ?? '▶'
            )}
          </span>
          <div className="yt-identity">
            <div className="yt-title-line">
              <strong>{channel.title}</strong>
              <span className={`yt-scope yt-scope-${channel.commentsScope ?? 'pending'}`}>
                {channel.commentsScope === 'channel'
                  ? t('Kanal geneli yorumlar')
                  : channel.commentsScope === 'videos'
                    ? t('Son videoların yorumları')
                    : t('Yorumlar kontrol ediliyor')}
              </span>
            </div>
            <span className="yt-handle" dir="auto">
              {channel.handle ?? channel.channelId}
            </span>
            <div className="yt-key-line">
              <span>{t('Kanal anahtarı')}</span>
              {data.youtubeKeys.length > 1 ? (
                <select
                  className="input select select-compact"
                  value={channel.keyId ?? ''}
                  onChange={(event) =>
                    void actions.setYoutubeChannelKey(channel.id, event.target.value)
                  }
                  aria-label={t('Kanal anahtarı')}
                >
                  {data.youtubeKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.label}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{channelKey?.label ?? '—'}</strong>
              )}
            </div>
          </div>
        </div>
        <div className="yt-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void refresh()}
            disabled={refreshing || !channelKeyReady}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            {refreshing ? t('Kontrol ediliyor…') : t('Yenile')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void actions.openExternal(channelLink)}
          >
            <ArrowUpRight size={13} /> {t('Kanalı aç')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void actions.openExternal(youtubeStudioUrl(channel.channelId))}
          >
            <ExternalLink size={13} /> {t('Studio')}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => void unbind()}
            disabled={unbinding}
            aria-label={t('YouTube kanalını kaldır')}
            title={t('YouTube kanalını kaldır')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!channelKeyReady ? (
        <div className="yt-alert warn">
          <KeyRound size={15} />
          <div>
            <strong>{t('YouTube API anahtarı yok')}</strong>
            <span>
              {t(
                'Yeni veri alınmıyor. Kanal verilerini güncellemek için Ayarlar’dan anahtarı yeniden ekle.',
              )}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('settings')}
          >
            {t('Ayarları aç')}
          </button>
        </div>
      ) : null}

      <div className="yt-stats">
        <div className="yt-stat">
          <span className="yt-stat-icon"><Users size={15} /></span>
          <span className="yt-stat-label">{t('Abone')}</span>
          <strong title={channel.subscribers != null ? fullNumber(channel.subscribers, locale) : undefined}>
            {channel.hiddenSubscribers ? t('Gizli') : compactNumber(channel.subscribers, locale)}
          </strong>
          <span className="yt-stat-note">
            {channel.hiddenSubscribers ? t('YouTube bu sayıyı gizliyor') : t('Toplam abone')}
          </span>
        </div>
        <div className="yt-stat">
          <span className="yt-stat-icon"><Eye size={15} /></span>
          <span className="yt-stat-label">{t('Görüntüleme')}</span>
          <strong title={channel.views != null ? fullNumber(channel.views, locale) : undefined}>
            {compactNumber(channel.views, locale)}
          </strong>
          <span className="yt-stat-note">{t('Kanal toplamı')}</span>
        </div>
        <div className="yt-stat">
          <span className="yt-stat-icon"><Video size={15} /></span>
          <span className="yt-stat-label">{t('Video')}</span>
          <strong>{channel.videos != null ? fullNumber(channel.videos, locale) : '—'}</strong>
          <span className="yt-stat-note">{t('Yayında')}</span>
        </div>
        <div className="yt-stat">
          <span className="yt-stat-icon"><RefreshCw size={15} /></span>
          <span className="yt-stat-label">{t('Son kontrol')}</span>
          <strong className="yt-stat-time">
            {channel.lastCheckedAt ? relativeTime(channel.lastCheckedAt) : '—'}
          </strong>
          <span className="yt-stat-note">
            {channel.lastCheckedAt ? t('Abone sayısı karşılaştırıldı') : t('İlk kontrol bekleniyor')}
          </span>
        </div>
      </div>

      <div className="yt-support">
        <div className="yt-support-head">
          <div>
            <strong>{t('Destek özeti')}</strong>
            <span>{t('Bu cihaz izlemeye başladıktan sonraki son 7 gün.')}</span>
          </div>
        </div>
        <div className="yt-support-grid">
          <div className="yt-support-item">
            <span className="yt-support-icon"><UserPlus size={15} /></span>
            <div>
              <span>{t('Yeni abone')}</span>
              <strong className={newSubscribers > 0 ? 'up' : ''}>
                {channel.hiddenSubscribers ? '—' : `+${newSubscribers}`}
              </strong>
              <small>{t('Son 7 gün')}</small>
            </div>
          </div>
          <div className="yt-support-item">
            <span className="yt-support-icon"><MessageCircle size={15} /></span>
            <div>
              <span>{t('Yeni yorum')}</span>
              <strong className={newComments > 0 ? 'up' : ''}>{newComments}</strong>
              <small>{t('Son 7 gün')}</small>
            </div>
          </div>
          <div className="yt-support-item">
            <span className="yt-support-icon"><ThumbsUp size={15} /></span>
            <div>
              <span>{t('Yorum beğenisi')}</span>
              <strong className={commentLikes > 0 ? 'up' : ''}>{commentLikes}</strong>
              <small>{t('Son getirilen yorumlarda')}</small>
            </div>
          </div>
        </div>
      </div>

      {lastError ? (
        <div className="yt-alert danger">
          <AlertTriangle size={15} />
          <div>
            <strong>{t('Kanal verisi alınamadı')}</strong>
            <span dir="auto">{lastError}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            {t('Tekrar dene')}
          </button>
        </div>
      ) : null}

      {commentsError ? (
        <div className="yt-alert warn">
          <MessageCircle size={15} />
          <div>
            <strong>{t('Yorumlar alınamıyor')}</strong>
            <span dir="auto">{commentsError}</span>
          </div>
        </div>
      ) : null}

      {channel.hiddenSubscribers ? (
        <p className="yt-inline-note">
          {t(
            'Bu kanal abone sayısını gizliyor. YouTube tekil abone olayı sunmadığı için gizli kanallarda abone artışı bildirimi alınamaz.',
          )}
        </p>
      ) : null}

      <div className="yt-columns">
        <div className="yt-panel">
          <div className="yt-panel-head">
            <strong>{t('Son hareketler')}</strong>
            <span>{t('Abone ve yorum akışı')}</span>
          </div>
          {events.length === 0 ? (
            <div className="yt-empty">
              <YoutubeIcon size={17} />
              <span>
                {channel.lastCheckedAt
                  ? t('Yeni yorum ve abone artışları burada listelenir.')
                  : t('İlk kontrol tamamlanınca hareketler burada görünür.')}
              </span>
            </div>
          ) : (
            <div className="yt-event-list">
              {events.map((event) => {
                const videoUrl = event.videoId ? youtubeVideoUrl(event.videoId) : null;
                const content = (
                  <>
                    <span
                      className={`yt-event-icon ${event.kind === 'subscriber' ? 'subscriber' : ''}`}
                    >
                      {event.kind === 'subscriber' ? (
                        <UserPlus size={14} />
                      ) : (
                        <MessageCircle size={14} />
                      )}
                    </span>
                    <span className="yt-event-main">
                      <span className="yt-event-title" dir="auto">
                        {event.kind === 'subscriber'
                          ? t('{count} yeni abone', { count: event.count ?? 0 })
                          : event.author ?? t('Yeni yorum')}
                        <span className="yt-event-time">{relativeTime(event.at)}</span>
                      </span>
                      {event.text ? (
                        <span className="yt-event-text" dir="auto">{event.text}</span>
                      ) : event.videoTitle ? (
                        <span className="yt-event-text" dir="auto">{event.videoTitle}</span>
                      ) : null}
                    </span>
                    {videoUrl ? <ArrowUpRight size={13} className="yt-event-arrow" /> : null}
                  </>
                );
                return videoUrl ? (
                  <button
                    type="button"
                    key={event.id}
                    className="yt-event"
                    onClick={() => void actions.openExternal(videoUrl)}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={event.id} className="yt-event">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="yt-panel">
          <div className="yt-panel-head">
            <strong>{t('Son yorumlar')}</strong>
            <span>{t('Herkese açık yorumlar')}</span>
          </div>
          {channel.recentComments.length === 0 ? (
            <div className="yt-empty">
              <MessageCircle size={17} />
              <span>
                {channel.commentsError
                  ? t('Yorumlar alınamıyor.')
                  : t('Henüz görünür bir yorum yok.')}
              </span>
            </div>
          ) : (
            <div className="yt-comment-list">
              {channel.recentComments.map((comment) => {
                const commentUrl = youtubeCommentUrl(comment);
                const published = comment.publishedAt ? Date.parse(comment.publishedAt) : null;
                const content = (
                  <>
                    <span className="yt-comment-head">
                      <strong dir="auto">{comment.author}</strong>
                      <span>{published ? relativeTime(published) : '—'}</span>
                    </span>
                    <span className="yt-comment-text" dir="auto">{comment.text}</span>
                    <span className="yt-comment-meta">
                      <span dir="auto">
                        {comment.videoTitle ?? (comment.videoId ? t('Video') : t('Kanal yorumu'))}
                      </span>
                      {comment.likeCount != null ? (
                        <span className="yt-likes">
                          <ThumbsUp size={11} /> {fullNumber(comment.likeCount, locale)}
                        </span>
                      ) : null}
                    </span>
                  </>
                );
                return commentUrl ? (
                  <button
                    type="button"
                    key={comment.id}
                    className="yt-comment"
                    onClick={() => void actions.openExternal(commentUrl)}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={comment.id} className="yt-comment">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="yt-fineprint">
        {t(
          'YouTube tekil abone olayı sunmaz; abone artışı toplam abone sayısının karşılaştırılmasıyla, yeni yorumlar herkese açık yorum akışından algılanır. Kontroller yaklaşık 5–10 dakikada bir yapılır.',
        )}
      </p>
    </section>
  );
}
