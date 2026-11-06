import React from 'react';
import { createRoot } from 'react-dom/client';
import { installBrowserApi } from './browserApi';
import { WebAuthGate } from './WebAuthGate';
import { WebApp } from './WebApp';
import { AppProvider } from '../store';
import { I18nGate } from '../i18n/I18nGate';
import { applyReduceMotion, applyTheme, storedReduceMotion, storedTheme } from '../lib/appearance';
import { IS_TRAY } from '../lib/runtime';
import { registerServiceWorker } from './pwa';
import '../lib/native';
import '../styles.css';
import '../styles-communication.css';
import '../styles-admin.css';
import '../styles-web.css';

installBrowserApi();
applyTheme(storedTheme());
applyReduceMotion(storedReduceMotion());
document.documentElement.dataset.host = IS_TRAY ? 'tray' : 'web';
registerServiceWorker();

const container = document.getElementById('root');
if (!container) throw new Error('Kök eleman bulunamadı');

createRoot(container).render(
  <React.StrictMode>
    <WebAuthGate>
      <AppProvider>
        <I18nGate>
          <WebApp />
        </I18nGate>
      </AppProvider>
    </WebAuthGate>
  </React.StrictMode>,
);
