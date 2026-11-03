import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Bot,
  Building2,
  Cable,
  Calculator,
  FileText,
  Languages,
  LayoutDashboard,
  Link2,
  ListChecks,
  Mail,
  Music4,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { IS_WEB } from '../lib/runtime';
import type { IntentKind, Page } from '../nav';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: Page, companyId?: string | null) => void;
  onQuickAction: (kind: IntentKind) => void;
}

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof LayoutDashboard;
  run: () => void;
}

export function CommandPalette({ open, onClose, onNavigate, onQuickAction }: CommandPaletteProps) {
  const { data } = useApp();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const hiddenForWeb = new Set([
      'page-mail',
      'page-assistant',
      'page-connections',
      'page-music',
      'page-updates',
      'page-account',
    ]);

    const navItems: PaletteItem[] = [
      { id: 'page-dashboard', group: t('Sayfalar'), label: t('Genel Bakış'), icon: LayoutDashboard, run: () => onNavigate('dashboard') },
      { id: 'page-services', group: t('Sayfalar'), label: t('Servisler'), icon: Activity, run: () => onNavigate('services') },
      { id: 'page-companies', group: t('Sayfalar'), label: t('Şirketler'), icon: Building2, run: () => onNavigate('companies') },
      { id: 'page-mail', group: t('Sayfalar'), label: t('Posta'), icon: Mail, hint: t('Gmail hesapları'), run: () => onNavigate('mail') },
      { id: 'page-finance', group: t('Sayfalar'), label: t('Finans'), icon: Wallet, run: () => onNavigate('finance') },
      { id: 'page-tasks', group: t('Sayfalar'), label: t('Görev & Notlar'), icon: ListChecks, run: () => onNavigate('tasks') },
      { id: 'page-tools', group: t('Araçlar'), label: t('Hesap & Kur'), hint: t('Hesap makinesi · canlı döviz'), icon: Calculator, run: () => onNavigate('tools') },
      { id: 'page-assistant', group: t('Stüdyo'), label: t('Asistan'), icon: Bot, hint: t('Yerel komutlar · genel sorular'), run: () => onNavigate('assistant') },
      { id: 'page-connections', group: t('Stüdyo'), label: t('Bağlantılar'), icon: Link2, run: () => onNavigate('connections') },
      { id: 'page-music', group: t('Stüdyo'), label: t('Müzik'), icon: Music4, run: () => onNavigate('music') },
      { id: 'page-translate', group: t('Stüdyo'), label: t('Çeviri'), icon: Languages, run: () => onNavigate('translate') },
      { id: 'page-updates', group: t('Stüdyo'), label: t('Güncellemeler'), icon: Sparkles, run: () => onNavigate('updates') },
      { id: 'page-account', group: t('Sayfalar'), label: t('Hesap'), icon: UserRound, hint: t('Profil · güvenlik · şifre'), run: () => onNavigate('account') },
      { id: 'page-settings', group: t(IS_WEB ? 'Sistem' : 'Sayfalar'), label: t('Ayarlar'), icon: Settings, run: () => onNavigate('settings') },
    ];

    const actions: PaletteItem[] = [
      { id: 'action-company', group: t('Hızlı işlemler'), label: t('Yeni şirket ekle'), hint: t('Şirket'), icon: Plus, run: () => onQuickAction('company') },
      { id: 'action-asset', group: t('Hızlı işlemler'), label: t('Servis bağla'), hint: t('Discord · Pterodactyl · Site'), icon: Cable, run: () => onQuickAction('asset') },
      { id: 'action-finance', group: t('Hızlı işlemler'), label: t('Finans kaydı ekle'), hint: t('Gelir / gider'), icon: Wallet, run: () => onQuickAction('finance') },
      { id: 'action-task', group: t('Hızlı işlemler'), label: t('Görev ekle'), hint: t('Hatırlatma'), icon: ListChecks, run: () => onQuickAction('task') },
      { id: 'action-note', group: t('Hızlı işlemler'), label: t('Not ekle'), hint: t('Fikir / kayıt'), icon: FileText, run: () => onQuickAction('note') },
    ];

    const companyItems: PaletteItem[] = (data?.companies ?? []).map((company) => ({
      id: `company-${company.id}`,
      group: t('Şirketler'),
      label: company.name,
      hint: company.description || t('Şirket detayını aç'),
      icon: Building2,
      run: () => onNavigate('company', company.id),
    }));

    const normalized = query.trim().toLocaleLowerCase(locale);
    const visibleNav = IS_WEB
      ? navItems.filter((item) => !hiddenForWeb.has(item.id))
      : navItems;
    const all = [...visibleNav, ...actions, ...companyItems];
    if (!normalized) return all;
    return all.filter((item) =>
      `${item.label} ${item.hint ?? ''} ${item.group}`.toLocaleLowerCase(locale).includes(normalized),
    );
  }, [data, locale, onNavigate, onQuickAction, query, t]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-index="${selected}"]`);
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const run = (item: PaletteItem) => {
    onClose();
    item.run();
  };

  let lastGroup = '';

  return createPortal(
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('Komut paleti')}>
        <div className="palette-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((prev) => (items.length ? (prev + 1) % items.length : 0));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const item = items[selected];
                if (item) run(item);
              }
            }}
            placeholder={t('Bir sayfa, şirket veya işlem ara…')}
            aria-label={t('Komut paletinde ara')}
          />
          <kbd>ESC</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {items.length === 0 ? (
            <div className="palette-empty">{t('Eşleşen sonuç yok.')}</div>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon;
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {showGroup ? <div className="palette-group">{item.group}</div> : null}
                  <button
                    type="button"
                    data-index={index}
                    className={`palette-item ${index === selected ? 'active' : ''}`}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => run(item)}
                  >
                    <span className="palette-item-icon">
                      <Icon size={15} />
                    </span>
                    <span className="palette-item-label">{item.label}</span>
                    {item.hint ? <span className="palette-item-hint">{item.hint}</span> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t('gez')}
          </span>
          <span>
            <kbd>↵</kbd> {t('seç')}
          </span>
          <span>
            <kbd>esc</kbd> {t('kapat')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
