import { useEffect, useState } from 'react';
import { scopedStorageKey } from './workspaceScope';

const BOT_HINTS_KEY = 'ezwin.hub.web.botHints.v1';
const BOT_HINTS_EVENT = 'ezwin:bot-hints';

export type BotHints = Record<string, string>;

export function readBotHints(): BotHints {
  try {
    const raw = localStorage.getItem(scopedStorageKey(BOT_HINTS_KEY));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const hints: BotHints = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value) hints[id] = value;
    }
    return hints;
  } catch {
    return {};
  }
}

export function writeBotHints(hints: BotHints): void {
  try {
    localStorage.setItem(scopedStorageKey(BOT_HINTS_KEY), JSON.stringify(hints));
  } catch {
    /* the hint is cosmetic; the tray keeps the encrypted token */
  }
  window.dispatchEvent(new Event(BOT_HINTS_EVENT));
}

export function setBotHint(id: string, hint: string | null): void {
  const hints = readBotHints();
  if (hint) hints[id] = hint;
  else delete hints[id];
  writeBotHints(hints);
}

export function useBotHints(): BotHints {
  const [hints, setHints] = useState<BotHints>(readBotHints);
  useEffect(() => {
    const update = () => setHints(readBotHints());
    window.addEventListener(BOT_HINTS_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(BOT_HINTS_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return hints;
}
