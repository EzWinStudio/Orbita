import React from 'react';
import { createRoot } from 'react-dom/client';
import { installBrowserApi } from './browserApi';
import { WebAuthGate } from './WebAuthGate';
import { WebApp } from './WebApp';
import { AppProvider } from '../store';
import { I18nGate } from '../i18n/I18nGate';
import { applyReduceMotion, applyTheme, storedReduceMotion, storedTheme } from '../lib/appearance';
import '../styles.css';
import '../styles-web.css';

installBrowserApi();
applyTheme(storedTheme());
applyReduceMotion(storedReduceMotion());

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
