import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { WebTitleBar } from './WebTitleBar';
import { WebSidebar } from './WebSidebar';
import { WebSettings } from './WebSettings';
import { CommandPalette } from '../components/CommandPalette';
import { Wordmark, LogoMark } from '../components/Logo';
import { Dashboard } from '../pages/Dashboard';
import { Services } from '../pages/Services';
import { Companies } from '../pages/Companies';
import { CompanyDetail } from '../pages/CompanyDetail';
import { Finance } from '../pages/Finance';
import { Operations } from '../pages/Operations';
import { Communication } from '../pages/Communication';
import { Business } from '../pages/Business';
import { Admin } from '../pages/Admin';
import { Assistant } from '../pages/Assistant';
import { TasksNotes } from '../pages/TasksNotes';
import { Tools } from '../pages/Tools';
import { Translate } from '../pages/Translate';
import { useApp } from '../store';
import { useI18n } from '../i18n';
import { IS_TRAY } from '../lib/runtime';
import { PRODUCT_NAME } from '../lib/product';
import { TrayBackgroundAgent } from './TrayBackgroundAgent';
import { startSyncAgent } from './cloudSync';
import { PAGE_LABEL, type IntentKind, type NavIntent, type Page } from '../nav';

const QUICK_ACTION_PAGE: Record<IntentKind, Page> = {
  company: 'companies',
  asset: 'services',
  finance: 'finance',
  task: 'tasks',
  note: 'tasks',
};

const WEB_PAGES: Page[] = [
  'dashboard',
  'services',
  'companies',
  'company',
  'finance',
  'operations',
  'communication',
  'business',
  'admin',
  'assistant',
  'tasks',
  'tools',
  'translate',
  'settings',
];

export function WebApp() {
  const { loading, fatalError, data, toast } = useApp();
  const { t } = useI18n();
  const [page, setPage] = useState<Page | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [intent, setIntent] = useState<NavIntent | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  const startPage = data?.settings.startPage;
  const fallbackPage =
    startPage && WEB_PAGES.includes(startPage) ? startPage : 'dashboard';
  const activePage: Page = page ?? fallbackPage;

  const navigate = useCallback((next: Page, nextCompanyId?: string | null) => {
    setPage(next);
    setCompanyId(nextCompanyId ?? null);
    setIntent(null);
    setNavOpen(false);
  }, []);

  const quickAction = useCallback(
    (kind: IntentKind) => {
      if ((kind === 'asset' || kind === 'finance') && data && data.companies.length === 0) {
        setPage('companies');
        setCompanyId(null);
        setIntent(null);
        toast('info', t('Önce bir şirket eklemelisin.'));
        return;
      }
      setPage(QUICK_ACTION_PAGE[kind]);
      setCompanyId(null);
      setIntent({ kind, at: Date.now() });
    },
    [data, t, toast],
  );

  const handleIntent = useCallback(() => setIntent(null), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setNavOpen(false);
  }, [activePage, companyId]);

  useEffect(() => {
    if (!data) return;
    const label = activePage === 'company'
      ? data.companies.find((company) => company.id === companyId)?.name
      : t(PAGE_LABEL[activePage]);
    document.title = label ? `${PRODUCT_NAME} · ${label}` : PRODUCT_NAME;
  }, [activePage, companyId, data, t]);

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-wordmark">
          <Wordmark />
        </div>
        <p className="boot-sub">{t('Komuta merkezi hazırlanıyor')}</p>
        <div className="boot-line" />
      </div>
    );
  }

  if (fatalError || !data) {
    return (
      <div className="fatal-screen">
        <div className="fatal-card">
          <span className="fatal-icon"><AlertTriangle size={20} /></span>
          <LogoMark size={34} />
          <h1>{t('Orbita başlatılamadı')}</h1>
          <p>{fatalError ?? t('Veriler yüklenemedi. Uygulamayı yeniden başlatmayı dene.')}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            <RotateCw size={15} /> {t('Yeniden dene')}
          </button>
        </div>
      </div>
    );
  }

  const companyName =
    activePage === 'company'
      ? data.companies.find((company) => company.id === companyId)?.name
      : undefined;

  let content: React.ReactNode;
  switch (activePage) {
    case 'services':
      content = <Services navigate={navigate} intent={intent} onIntentHandled={handleIntent} />;
      break;
    case 'companies':
      content = <Companies navigate={navigate} intent={intent} onIntentHandled={handleIntent} />;
      break;
    case 'company':
      content = companyId ? (
        <CompanyDetail companyId={companyId} navigate={navigate} />
      ) : (
        <Companies navigate={navigate} intent={intent} onIntentHandled={handleIntent} />
      );
      break;
    case 'finance':
      content = <Finance navigate={navigate} intent={intent} onIntentHandled={handleIntent} />;
      break;
    case 'operations':
      content = <Operations navigate={navigate} />;
      break;
    case 'communication':
      content = <Communication navigate={navigate} />;
      break;
    case 'business':
      content = <Business navigate={navigate} />;
      break;
    case 'admin':
      content = <Admin navigate={navigate} />;
      break;
    case 'assistant':
      content = <Assistant navigate={navigate} />;
      break;
    case 'tasks':
      content = <TasksNotes intent={intent} onIntentHandled={handleIntent} />;
      break;
    case 'tools':
      content = <Tools />;
      break;
    case 'translate':
      content = <Translate />;
      break;
    case 'settings':
      content = <WebSettings />;
      break;
    default:
      content = <Dashboard navigate={navigate} onOpenPalette={() => setPaletteOpen(true)} />;
  }

  return (
    <div className="app">
      <div className="app-ambient" aria-hidden="true">
        <div className="ambient-glow ambient-one" />
        <div className="ambient-glow ambient-two" />
        <div className="ambient-grid" />
      </div>

      <WebTitleBar
        page={activePage}
        label={companyName}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenTools={() => navigate('tools')}
        onToggleNav={() => setNavOpen((prev) => !prev)}
      />

      <div className="shell">
        <WebSidebar
          page={activePage}
          companyId={companyId}
          navigate={navigate}
          open={navOpen}
        />
        {navOpen ? (
          <button
            type="button"
            className="web-nav-scrim"
            aria-label={t('Kapat')}
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <main className="main" ref={scrollRef}>
          <div className="page-wrap">{content}</div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onQuickAction={quickAction}
      />
      {IS_TRAY ? <TrayBackgroundAgent /> : null}
      <SyncAgent />
    </div>
  );
}

function SyncAgent() {
  useEffect(() => startSyncAgent(), []);
  return null;
}
