import { useEffect, useRef } from 'react';
import { useApp } from '../store';
import type { AccountSecurity } from '../types';

/**
 * Hesabın güvenlik politikasını uygular: hareketsizlikte otomatik kilit ve
 * isteğe bağlı olarak pencere odağı kaybolunca kilitleme.
 */
export function AutoLock() {
  const { actions } = useApp();
  const securityRef = useRef<AccountSecurity | null>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const payload = await window.ezwin?.session.get();
        if (active && payload?.account) {
          securityRef.current = payload.account.security;
        }
      } catch {
        /* politika okunamazsa kilit uygulanmaz */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ];
    for (const event of events) {
      window.addEventListener(event, touch, { passive: true });
    }

    const lockIfNeeded = () => {
      if (securityRef.current?.lockOnBlur) void actions.lockApp();
    };
    const onVisibility = () => {
      if (document.hidden) lockIfNeeded();
    };
    window.addEventListener('blur', lockIfNeeded);
    document.addEventListener('visibilitychange', onVisibility);

    const timer = window.setInterval(() => {
      const minutes = securityRef.current?.autoLockMinutes ?? 0;
      if (minutes <= 0) return;
      // Müzik çalarken hareketsizlik sayılmaz; çalan ses kilidi tetiklemesin.
      const audio = document.querySelector('audio');
      if (audio && !audio.paused && !audio.ended) {
        lastActivity.current = Date.now();
        return;
      }
      if (Date.now() - lastActivity.current >= minutes * 60 * 1000) {
        void actions.lockApp();
      }
    }, 20_000);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, touch);
      }
      window.removeEventListener('blur', lockIfNeeded);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [actions]);

  return null;
}
