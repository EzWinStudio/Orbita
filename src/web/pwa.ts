import { IS_TRAY } from '../lib/runtime';
import { IS_ANDROID_APP } from '../lib/native';

export function registerServiceWorker(): void {
  if (IS_ANDROID_APP) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {
        /* the bundled app works without a service worker */
      });
    return;
  }
  if (IS_TRAY || !import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {
        /* offline support is optional; the app keeps working online */
      });
  });
}
