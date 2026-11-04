import { getTrayHost } from '../lib/runtime';

export interface TrayTickOptions {
  force?: boolean;
  source?: string;
}

export interface TraySiteTarget {
  id: string;
  name: string;
  url: string;
}

export interface TraySiteResult {
  id: string;
  state: 'online' | 'degraded' | 'offline';
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: number;
}

export interface TrayHostMessage {
  kind?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    __ezwinTrayTick?: (options?: TrayTickOptions) => void;
  }
}

export function sendToTrayHost(message: unknown): boolean {
  const host = getTrayHost();
  if (!host) return false;
  try {
    host.postMessage(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

export function onTrayHostMessage(handler: (message: TrayHostMessage) => void): () => void {
  const host = getTrayHost();
  if (!host) return () => {};
  const listener = (event: { data: unknown }) => {
    let parsed: unknown = event.data;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return;
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      handler(parsed as TrayHostMessage);
    }
  };
  if (typeof host.onMessage === 'function') {
    return host.onMessage(listener);
  }
  if (typeof host.addEventListener !== 'function') return () => {};
  host.addEventListener('message', listener);
  return () => {
    try {
      host.removeEventListener?.('message', listener);
    } catch {
      /* host is going away */
    }
  };
}

export function requestTrayCheck(source = 'ui'): boolean {
  const tick = window.__ezwinTrayTick;
  if (!tick) return false;
  tick({ force: true, source });
  return true;
}
