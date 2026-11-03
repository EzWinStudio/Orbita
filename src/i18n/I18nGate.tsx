import type { ReactNode } from 'react';
import { useApp } from '../store';
import { I18nProvider } from './index';

export function I18nGate({ children }: { children: ReactNode }) {
  const { language, setLanguage } = useApp();
  return (
    <I18nProvider
      language={language}
      onLanguageChange={(next) => {
        void setLanguage(next);
      }}
    >
      {children}
    </I18nProvider>
  );
}
