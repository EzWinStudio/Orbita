import { getTrayHost } from '../lib/runtime';
import { setBotHint, writeBotHints, type BotHints } from './botSecrets';
import { onTrayHostMessage, sendToTrayHost, type TrayHostMessage } from './trayBridge';

export interface BotSecretResult {
  ok: boolean;
  hint?: string | null;
  error?: string;
}

interface PendingRequest {
  resolve: (value: BotSecretResult) => void;
  timer: number;
}

const pending = new Map<string, PendingRequest>();
let sequence = 0;
let listening = false;

function ensureListener(): void {
  if (listening || !getTrayHost()) return;
  listening = true;
  onTrayHostMessage((message: TrayHostMessage) => {
    if (message.kind === 'bot-secret-status') {
      const source = message.hints;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return;
      const hints: BotHints = {};
      for (const [id, value] of Object.entries(source as Record<string, unknown>)) {
        if (typeof value === 'string' && value) hints[id] = value;
      }
      writeBotHints(hints);
      return;
    }
    if (message.kind !== 'bot-secret-saved') return;
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    const id = typeof message.id === 'string' ? message.id : '';
    const ok = message.ok === true;
    const hint = typeof message.hint === 'string' ? message.hint : null;
    if (id) setBotHint(id, ok ? hint : null);
    const request = pending.get(requestId);
    if (!request) return;
    window.clearTimeout(request.timer);
    pending.delete(requestId);
    request.resolve({
      ok,
      hint,
      error: typeof message.error === 'string' ? message.error : undefined,
    });
  });
}

function request(message: Record<string, unknown>, timeoutMs = 15000): Promise<BotSecretResult> {
  ensureListener();
  if (!getTrayHost()) {
    return Promise.resolve({ ok: false, error: 'Masaüstü uygulaması gerekli.' });
  }
  const requestId = `bot-${Date.now()}-${++sequence}`;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pending.delete(requestId);
      resolve({ ok: false, error: 'Masaüstü yanıt vermedi.' });
    }, timeoutMs);
    pending.set(requestId, { resolve, timer });
    const sent = sendToTrayHost({ ...message, requestId });
    if (!sent) {
      window.clearTimeout(timer);
      pending.delete(requestId);
      resolve({ ok: false, error: 'Masaüstü uygulaması gerekli.' });
    }
  });
}

export function saveBotSecret(id: string, token: string): Promise<BotSecretResult> {
  return request({ kind: 'bot-secret-save', id, token });
}

export function clearBotSecret(id: string): Promise<BotSecretResult> {
  return request({ kind: 'bot-secret-clear', id });
}

export function requestBotSecretStatus(): void {
  ensureListener();
  if (!getTrayHost()) return;
  sendToTrayHost({ kind: 'bot-secret-status' });
}

export function checkBotsNow(bots: Array<{ id: string; name: string }>): void {
  ensureListener();
  if (!getTrayHost() || bots.length === 0) return;
  sendToTrayHost({ kind: 'check-bots', bots, requestedAt: Date.now() });
}
