import { useId } from 'react';
import type { HistoryPoint } from '../types';
import { useI18n } from '../i18n';

interface SparklineProps {
  history: HistoryPoint[];
  height?: number;
}

export function Sparkline({ history, height = 38 }: SparklineProps) {
  const { t } = useI18n();
  const gradientId = useId().replace(/:/g, '');
  const points = history.slice(-40);

  if (points.length < 2) {
    return (
      <div className="sparkline sparkline-empty" style={{ height }}>
        {t('Yeterli kontrol verisi yok')}
      </div>
    );
  }

  const width = 140;
  const pad = 3;
  const values = points.map((point) => (point.ok ? point.ms ?? 0 : 0));
  const max = Math.max(...values, 1);
  const step = (width - pad * 2) / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = pad + index * step;
    const normalized = point.ok ? Math.min(1, (point.ms ?? 0) / max) : 0;
    const y = height - pad - normalized * (height - pad * 2);
    return { x, y, point };
  });

  const line = coords.map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(' ');
  const area = `M${pad},${height - pad} L${coords
    .map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`)
    .join(' L')} L${(width - pad).toFixed(1)},${height - pad} Z`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t('Son {count} kontrolün yanıt süresi grafiği', { count: points.length })}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.24 }} />
          <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        style={{ stroke: 'var(--accent)' }}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {coords
        .filter((coord) => !coord.point.ok)
        .map((coord) => (
          <circle
            key={coord.point.t}
            cx={coord.x}
            cy={height - pad}
            r="2"
            fill="#ff6b6b"
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  );
}
