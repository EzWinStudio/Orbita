import type { YoutubeChannel, YoutubeComment } from '../types';

export function youtubeChannelUrl(channel: Pick<YoutubeChannel, 'channelId' | 'handle'>): string {
  const handle = channel.handle?.trim();
  if (handle && handle.startsWith('@')) return `https://www.youtube.com/${handle}`;
  return `https://www.youtube.com/channel/${channel.channelId}`;
}

export function youtubeStudioUrl(channelId: string): string {
  return `https://studio.youtube.com/channel/${channelId}`;
}

export function youtubeVideoUrl(videoId: string | null): string | null {
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

export function youtubeCommentUrl(comment: Pick<YoutubeComment, 'id' | 'videoId'>): string | null {
  if (!comment.videoId) return null;
  return `https://www.youtube.com/watch?v=${comment.videoId}&lc=${encodeURIComponent(comment.id)}`;
}

export function compactNumber(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  try {
    if (Math.abs(value) < 10000) return new Intl.NumberFormat(locale).format(value);
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function fullNumber(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}
