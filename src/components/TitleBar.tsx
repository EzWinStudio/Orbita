import { Calculator, Search } from 'lucide-react';
import { PAGE_LABEL, type Page } from '../nav';
import { useApp } from '../store';
import { useI18n } from '../i18n';

interface TitleBarProps {
  page: Page;
  label?: string;
  onOpenPalette: () => void;
  onOpenTools: () => void;
}

export function TitleBar({ page, label, onOpenPalette, onOpenTools }: TitleBarProps) {
  const { data } = useApp();
  const { t, locale } = useI18n();
  const lastChecked = data
    ? Math.max(0, ...Object.values(data.statuses).map((status) => status.checkedAt))
    : 0;
  const monitored = data
    ? data.assets.filter((asset) => asset.type === 'website' || asset.hasSecret).length
    : 0;

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <span className="titlebar-brand">ORBITA</span>
        <span className="titlebar-sep" />
        <span className="titlebar-page">{label ?? t(PAGE_LABEL[page])}</span>
      </div>

      <button type="button" className="palette-trigger" onClick={onOpenPalette}>
        <Search size={13} />
        <span>{t('Komut paleti veya şirket ara…')}</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="titlebar-right">
        <button
          type="button"
          className="titlebar-tool"
          onClick={onOpenTools}
          title={t('Hesap makinesi ve canlı kur')}
          aria-label={t('Hesap makinesi ve canlı kur')}
        >
          <Calculator size={14} />
          <span>{t('Hesap & Kur')}</span>
        </button>
        <span className={`titlebar-status ${monitored > 0 ? 'is-live' : ''}`}>
          <span className="live-dot" />
          {monitored > 0
            ? `${t('{count} servis izleniyor', { count: monitored })}${
                lastChecked
                  ? ' · ' +
                    t('son kontrol {time}', {
                      time: new Date(lastChecked).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })
                  : ''
              }`
            : t('İzleme bekliyor')}
        </span>
      </div>
    </header>
  );
}
