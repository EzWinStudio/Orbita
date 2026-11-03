import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccountGate } from '../pages/AccountGate';
import type { AccountInfo } from '../types';
import { SplashIntro } from './SplashIntro';

type GateState = 'loading' | 'locked' | 'ready';

/**
 * Uygulama her açılışta hesap ister. Oturum yoksa arayüz hiç yüklenmez:
 * AppProvider yalnızca girişten sonra bağlanır, böylece kilitliyken hiçbir
 * veri okunmaz.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [intro, setIntro] = useState<'visible' | 'leaving' | 'gone'>('visible');

  const refresh = useCallback(async () => {
    const api = window.ezwin;
    if (!api) {
      setState('locked');
      return;
    }
    try {
      const payload = await api.session.get();
      setAccounts(payload.accounts);
      setState(payload.locked ? 'locked' : 'ready');
    } catch {
      setState('locked');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const leaving = window.setTimeout(() => setIntro('leaving'), 1500);
    const gone = window.setTimeout(() => setIntro('gone'), 2050);
    return () => {
      window.clearTimeout(leaving);
      window.clearTimeout(gone);
    };
  }, []);

  return (
    <>
      {state === 'ready' ? children : null}
      {state === 'locked' ? <AccountGate accounts={accounts} onAuthed={refresh} /> : null}
      {state === 'loading' ? <div className="intro-backdrop" aria-hidden="true" /> : null}
      {intro !== 'gone' ? <SplashIntro leaving={intro === 'leaving'} /> : null}
    </>
  );
}
