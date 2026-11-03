import { IS_TRAY } from '../lib/runtime';

export function registerServiceWorker(): void {
  if (IS_TRAY || !import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* offline support is optional; the app keeps working online */
    });
  });
}
