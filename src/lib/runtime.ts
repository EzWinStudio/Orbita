export const IS_WEB = __EZWIN_WEB__;

type WebView2Window = Window & {
  chrome?: {
    webview?: {
      postMessage: (message: string) => void;
      addEventListener: (type: 'message', handler: (event: { data: unknown }) => void) => void;
      removeEventListener: (type: 'message', handler: (event: { data: unknown }) => void) => void;
    };
  };
};

export function getTrayHost() {
  if (typeof window === 'undefined') return null;
  return (window as WebView2Window).chrome?.webview ?? null;
}

export const IS_TRAY = Boolean(getTrayHost());
