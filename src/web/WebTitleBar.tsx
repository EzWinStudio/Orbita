import { Calculator, Menu, Search } from 'lucide-react';
import { PAGE_LABEL, type Page } from '../nav';
import { useI18n } from '../i18n';
import { IS_TRAY } from '../lib/runtime';

interface WebTitleBarProps {
  page: Page;
  label?: string;
  onOpenPalette: () => void;
  onOpenTools: () => void;
  onToggleNav: () => void;
}

export function WebTitleBar({
  page,
  label,
  onOpenPalette,
  onOpenTools,
  onToggleNav,
}: WebTitleBarProps) {
  const { t } = useI18n();

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <button
          type="button"
          className="web-menu-btn"
          onClick={onToggleNav}
          aria-label={t('Ana gezinme')}
        >
          <Menu size={17} />
        </button>
        <span className="titlebar-brand">EZWIN HUB</span>
        <span className="web-badge">{IS_TRAY ? t('Masaüstü') : 'WEB'}</span>
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
        <span className="titlebar-status web-titlebar-status">
          <span className="web-status-dot" />
          {IS_TRAY ? t('Yerel cihaz verisi') : t('Yerel tarayıcı verisi')}
        </span>
      </div>
    </header>
  );
}
