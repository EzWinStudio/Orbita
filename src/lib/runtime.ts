export const IS_WEB = __EZWIN_WEB__;

export interface TrayHost {
  postMessage: (message: string) => void;
  addEventListener?: (type: 'message', handler: (event: { data: unknown }) => void) => void;
  removeEventListener?: (type: 'message', handler: (event: { data: unknown }) => void) => void;
  onMessage?: (handler: (event: { data: unknown }) => void) => () => void;
}

type TrayHostWindow = Window & {
  chrome?: { webview?: TrayHost };
  ezwinHost?: TrayHost;
};

export function getTrayHost(): TrayHost | null {
  if (typeof window === 'undefined') return null;
  const host = window as TrayHostWindow;
  return host.ezwinHost ?? host.chrome?.webview ?? null;
}

export const IS_TRAY = Boolean(getTrayHost());
