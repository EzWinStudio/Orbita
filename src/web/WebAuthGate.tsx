import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { I18nProvider } from '../i18n';
import { translateFor } from '../i18n/core';
import { normalizeLanguage } from '../i18n/languages';
import type { LanguageCode } from '../types';
import { reportBrowserSave, setStoredLanguage } from './browserApi';
import { setWorkspaceScope } from './workspaceScope';
import { WebAuthScreen } from './WebAuthScreen';
import {
  ACCOUNTS_STORAGE_KEY,
  CLOUD_SESSION_KEY,
  SESSION_STORAGE_KEY,
  clearCloudSession,
  clearGuestSession,
  getActiveSession,
  getLocalAccount,
  hasGuestSession,
  logoutLocalAccount,
  readGuestAvatar,
  resetLocalAccount,
  startGuestSession,
  updateCloudSessionAvatar,
  updateLocalAccountAvatar,
  writeGuestAvatar,
  type AuthSession,
  type LocalAccount,
  type LocalSession,
} from './webAuth';
import {
  logoutCloudAccount,
  updateCloudProfile,
  validateCloudSession,
} from './cloudAuth';

interface WebAuthContextValue {
  account: LocalAccount;
  session: LocalSession;
  isGuest: boolean;
  cloud: boolean;
  signOut: () => void;
  createAccount: () => void;
  updateAvatar: (avatar: string | null) => void;
}

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

type GateState =
  | { phase: 'auth'; account: LocalAccount | null }
  | {
      phase: 'ready';
      account: LocalAccount;
      session: LocalSession;
      guest: boolean;
      cloud: boolean;
    };

const LANGUAGE_STORAGE_KEY = 'ezwin.language';
const GUEST_SESSION: LocalSession = { remember: false, expiresAt: 0 };

function storedLanguage(): LanguageCode {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return 'tr';
  }
}

function guestAccount(language: LanguageCode): LocalAccount {
  return {
    id: 'guest',
    name: translateFor(language, 'Misafir'),
    email: '',
    avatar: readGuestAvatar(),
    color: '#8b95a1',
    createdAt: Date.now(),
    lastLoginAt: null,
  };
}

export function WebAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() => {
    const active = getActiveSession();
    if (active) {
      return {
        phase: 'ready',
        account: active.account,
        session: active.session,
        guest: false,
        cloud: Boolean(active.cloud),
      };
    }
    if (hasGuestSession()) {
      setWorkspaceScope('guest');
      return {
        phase: 'ready',
        account: guestAccount(storedLanguage()),
        session: GUEST_SESSION,
        guest: true,
        cloud: false,
      };
    }
    return { phase: 'auth', account: getLocalAccount() };
  });
  const [language, setLanguageState] = useState<LanguageCode>(storedLanguage);

  const changeLanguage = useCallback((next: LanguageCode) => {
    const normalized = normalizeLanguage(next);
    setLanguageState(normalized);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      /* the screen still switches for this render */
    }
  }, []);

  const signOut = useCallback(() => {
    if (hasGuestSession()) {
      clearGuestSession();
      setState({ phase: 'auth', account: getLocalAccount() });
      return;
    }
    if (getActiveSession()?.cloud) {
      logoutCloudAccount();
      clearCloudSession();
      setState({ phase: 'auth', account: getLocalAccount() });
      return;
    }
    logoutLocalAccount();
    setState({ phase: 'auth', account: getLocalAccount() });
  }, []);

  const startGuest = useCallback(() => {
    startGuestSession();
    setWorkspaceScope('guest');
    setState({
      phase: 'ready',
      account: guestAccount(language),
      session: GUEST_SESSION,
      guest: true,
      cloud: false,
    });
  }, [language]);

  const createAccount = useCallback(() => {
    clearGuestSession();
    setState({ phase: 'auth', account: getLocalAccount() });
  }, []);

  const updateAvatar = useCallback((avatar: string | null) => {
    if (hasGuestSession()) {
      writeGuestAvatar(avatar);
      setState((current) =>
        current.phase === 'ready'
          ? { ...current, account: { ...current.account, avatar } }
          : current,
      );
      reportBrowserSave(true);
      return;
    }
    if (getActiveSession()?.cloud) {
      const next = updateCloudSessionAvatar(avatar);
      setState((current) =>
        current.phase === 'ready' ? { ...current, account: next } : current,
      );
      void updateCloudProfile(avatar);
      reportBrowserSave(true);
      return;
    }
    const next = updateLocalAccountAvatar(avatar);
    setState((current) =>
      current.phase === 'ready' ? { ...current, account: next } : current,
    );
    reportBrowserSave(true);
  }, []);

  const handleAuthed = useCallback(
    (result: AuthSession) => {
      clearGuestSession();
      setStoredLanguage(language);
      setState({
        phase: 'ready',
        account: result.account,
        session: result.session,
        guest: false,
        cloud: Boolean(result.cloud),
      });
    },
    [language],
  );

  const handleReset = useCallback((email?: string) => {
    resetLocalAccount(email);
    setState({ phase: 'auth', account: getLocalAccount() });
  }, []);

  const checkSession = useCallback(() => {
    if (hasGuestSession()) return;
    const active = getActiveSession();
    if (!active) {
      setState((current) =>
        current.phase === 'auth'
          ? current
          : { phase: 'auth', account: getLocalAccount() },
      );
      return;
    }
    if (active.cloud) {
      void validateCloudSession()
        .then((result) => {
          if (result.status === 'invalid') {
            clearCloudSession();
            setState((current) =>
              current.phase === 'auth'
                ? current
                : { phase: 'auth', account: getLocalAccount() },
            );
            return;
          }
          if (result.status === 'ok' && result.account) {
            setState((current) =>
              current.phase === 'ready'
                ? { ...current, account: result.account as LocalAccount }
                : current,
            );
          }
        })
        .catch(() => {
          /* offline web sessions keep their cached account */
        });
      return;
    }
    setState((current) => {
      if (current.phase === 'ready' && current.account.id === active.account.id) {
        if (current.account.avatar === active.account.avatar) return current;
        return {
          phase: 'ready',
          account: active.account,
          session: active.session,
          guest: false,
          cloud: false,
        };
      }
      return {
        phase: 'ready',
        account: active.account,
        session: active.session,
        guest: false,
        cloud: false,
      };
    });
  }, []);

  useEffect(() => {
    if (state.phase !== 'ready') return;
    const timer = window.setInterval(checkSession, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkSession, state.phase]);

  const cloudActive = state.phase === 'ready' && state.cloud;

  useEffect(() => {
    if (!cloudActive) return;
    checkSession();
  }, [checkSession, cloudActive]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== ACCOUNTS_STORAGE_KEY &&
        event.key !== SESSION_STORAGE_KEY &&
        event.key !== CLOUD_SESSION_KEY
      ) {
        return;
      }
      checkSession();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkSession]);

  if (state.phase === 'auth') {
    return (
      <I18nProvider language={language} onLanguageChange={changeLanguage}>
        <WebAuthScreen
          key={state.account?.id ?? 'unregistered'}
          account={state.account}
          onAuthed={handleAuthed}
          onReset={handleReset}
          onGuest={startGuest}
        />
      </I18nProvider>
    );
  }

  return (
    <WebAuthContext.Provider
      key={state.guest ? 'guest' : state.account.id}
      value={{
        account: state.account,
        session: state.session,
        isGuest: state.guest,
        cloud: state.cloud,
        signOut,
        createAccount,
        updateAvatar,
      }}
    >
      {children}
    </WebAuthContext.Provider>
  );
}

export function useWebAuth(): WebAuthContextValue {
  const context = useContext(WebAuthContext);
  if (!context) throw new Error('useWebAuth, WebAuthGate içinde kullanılmalı.');
  return context;
}
