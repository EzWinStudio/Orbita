import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { CommandPalette } from './components/CommandPalette';
import { Wordmark, LogoMark } from './components/Logo';
import { Dashboard } from './pages/Dashboard';
import { Services } from './pages/Services';
import { Companies } from './pages/Companies';
import { CompanyDetail } from './pages/CompanyDetail';
import { Mail } from './pages/Mail';
import { Finance } from './pages/Finance';
import { Operations } from './pages/Operations';
import { TasksNotes } from './pages/TasksNotes';
import { Tools } from './pages/Tools';
import { Settings } from './pages/Settings';
import { Connections } from './pages/Connections';
import { Music } from './pages/Music';
import { Translate } from './pages/Translate';
import { Updates } from './pages/Updates';
import { Assistant } from './pages/Assistant';
import { Account } from './pages/Account';
import { AutoLock } from './components/AutoLock';
import { useApp } from './store';
import { useI18n } from './i18n';
import type { IntentKind, NavIntent, Page } from './nav';

const QUICK_ACTION_PAGE: Record<IntentKind, Page> = {
  company: 'companies',
  asset: 'services',
  finance: 'finance',
  task: 'tasks',
  note: 'tasks',
};

export default function App() {
  const { loading, fatalError, data, toast } = useApp();
  const { t } = useI18n();
  const [page, setPage] = useState<Page | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [intent, setIntent] = useState<NavIntent | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const activePage: Page = page ?? data?.settings.startPage ?? 'dashboard';

  const navigate = useCallback((next: Page, nextCompanyId?: string | null) => {
    setPage(next);
    setCompanyId(nextCompanyId ?? null);
    setIntent(null);
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
  }, [activePage, companyId]);

  useEffect(() => {
    const off = window.ezwin?.onUpdateAvailable?.((payload) => {
      toast('info', `Yeni sürüm hazır: v${payload.latest ?? ''} — Güncellemeler sayfasından indirebilirsin.`);
    });
    return () => {
      if (off) off();
    };
  }, [toast]);

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
          <code>npm run dev</code>
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
    case 'mail':
      content = <Mail />;
      break;
    case 'tasks':
      content = <TasksNotes intent={intent} onIntentHandled={handleIntent} />;
      break;
    case 'tools':
      content = <Tools />;
      break;
    case 'connections':
      content = <Connections />;
      break;
    case 'music':
      content = <Music />;
      break;
    case 'translate':
      content = <Translate />;
      break;
    case 'updates':
      content = <Updates />;
      break;
    case 'assistant':
      content = <Assistant navigate={navigate} />;
      break;
    case 'account':
      content = <Account />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    default:
      content = <Dashboard navigate={navigate} onOpenPalette={() => setPaletteOpen(true)} />;
  }

  return (
    <div className="app">
      <AutoLock />
      <div className="app-ambient" aria-hidden="true">
        <div className="ambient-glow ambient-one" />
        <div className="ambient-glow ambient-two" />
        <div className="ambient-grid" />
      </div>

      <TitleBar
        page={activePage}
        label={companyName}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenTools={() => navigate('tools')}
      />

      <div className="shell">
        <Sidebar page={activePage} companyId={companyId} navigate={navigate} />
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
    </div>
  );
}
