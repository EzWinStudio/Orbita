import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store';
import { I18nGate } from './i18n/I18nGate';
import { SessionGate } from './components/SessionGate';
import { applyReduceMotion, applyTheme, storedReduceMotion, storedTheme } from './lib/appearance';
import './styles.css';
import './styles-mail.css';
import './styles-youtube.css';
import './styles-studio.css';

applyTheme(storedTheme());
applyReduceMotion(storedReduceMotion());

const container = document.getElementById('root');
if (!container) throw new Error('Kök eleman bulunamadı');

createRoot(container).render(
  <React.StrictMode>
    <SessionGate>
      <AppProvider>
        <I18nGate>
          <App />
        </I18nGate>
      </AppProvider>
    </SessionGate>
  </React.StrictMode>,
);
