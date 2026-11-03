import { useCallback, useEffect, useRef } from 'react';
import { useAppData } from '../store';
import { useI18n } from '../i18n';
import { tGlobal } from '../i18n/core';
import { getTrayHost } from '../lib/runtime';
import { applyServiceStatuses, clearServiceStatuses, exportPayload } from './browserApi';
import { readBotHints, writeBotHints } from './botSecrets';
import { requestBotSecretStatus } from './botBridge';
import {
  onTrayHostMessage,
  sendToTrayHost,
  type TrayHostMessage,
  type TraySiteResult,
  type TraySiteTarget,
  type TrayTickOptions,
} from './trayBridge';
import type { AppData, ServiceStatus } from '../types';

const AGENT_KEY = 'ezwin.hub.tray.v1';
const SITE_INTERVAL_MS = 10 * 60 * 1000;
const BOT_INTERVAL_MS = 10 * 60 * 1000;
const RATES_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_HOUR = 9;
const BACKUP_HOUR = 3;

interface AgentState {
  lastSitesAt?: number;
  lastBotsAt?: number;
  lastRatesAt?: number;
  lastBackupDate?: string;
  lastReminderDate?: string;
  lastBackupFailureDate?: string;
}

interface TrayBotTarget {
  id: string;
  name: string;
}

interface TrayBotGuild {
  id: string;
  name: string;
}

interface TrayBotResult {
  assetId: string;
  configured?: boolean;
  hint?: string | null;
  state?: 'online' | 'degraded' | 'offline';
  checkedAt?: number;
  latencyMs?: number | null;
  summary?: string;
  error?: string | null;
  discord?: {
    botId?: string;
    username?: string;
    guildCount?: number;
    guilds?: TrayBotGuild[];
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateStamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatClock(ts: number): string {
  const date = new Date(ts);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readAgentState(): AgentState {
  try {
    const raw = localStorage.getItem(AGENT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AgentState)
      : {};
  } catch {
    return {};
  }
}

function writeAgentState(next: AgentState): void {
  try {
    localStorage.setItem(AGENT_KEY, JSON.stringify(next));
  } catch {
    /* background state is best effort */
  }
}

function siteTargets(data: AppData): TraySiteTarget[] {
  const seen = new Set<string>();
  const targets: TraySiteTarget[] = [];
  for (const asset of data.assets) {
    if (asset.type !== 'website') continue;
    const url = asset.config.url?.trim();
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    targets.push({ id: asset.id, name: asset.name, url });
  }
  return targets;
}

function isSiteResult(value: unknown): value is TraySiteResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<TraySiteResult>;
  return (
    typeof result.id === 'string' &&
    (result.state === 'online' || result.state === 'degraded' || result.state === 'offline')
  );
}

function botTargets(data: AppData): TrayBotTarget[] {
  return data.assets
    .filter((asset) => asset.type === 'discord')
    .map((asset) => ({ id: asset.id, name: asset.name }));
}

function isBotResult(value: unknown): value is TrayBotResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<TrayBotResult>;
  return typeof result.assetId === 'string';
}

function sendTraySummary(
  data: AppData,
  statuses: Record<string, ServiceStatus>,
  checkedAt: number,
): void {
  const sites = siteTargets(data);
  const bots = botTargets(data);
  const onlineSites = sites.filter((target) => statuses[target.id]?.state === 'online').length;
  const onlineBots = bots.filter((target) => statuses[target.id]?.state === 'online').length;
  sendToTrayHost({
    kind: 'status',
    primary: tGlobal('{online}/{total} site çevrimiçi', {
      online: onlineSites,
      total: sites.length,
    }),
    secondary: bots.length
      ? tGlobal('Bot: {online}/{total} aktif · {time}', {
          online: onlineBots,
          total: bots.length,
          time: formatClock(checkedAt || Date.now()),
        })
      : `Son kontrol: ${formatClock(checkedAt || Date.now())}`,
  });
}

export function TrayBackgroundAgent() {
  const data = useAppData();
  const { t } = useI18n();
  const dataRef = useRef(data);
  const tRef = useRef(t);
  const statusesRef = useRef(data.statuses);
  const runTickRef = useRef<(options?: TrayTickOptions) => void>(() => {});
  const busyRef = useRef(false);
  const backupPendingRef = useRef(false);
  const sitePendingRef = useRef(false);
  const botPendingRef = useRef(false);

  dataRef.current = data;
  tRef.current = t;
  statusesRef.current = data.statuses;

  const notify = useCallback((title: string, body: string) => {
    sendToTrayHost({ kind: 'notify', title, body });
  }, []);

  const handleSiteResults = useCallback(
    (results: TraySiteResult[]) => {
      sitePendingRef.current = false;
      const current = dataRef.current;
      const translate = tRef.current;
      const previous = statusesRef.current;
      const next: Record<string, ServiceStatus> = {};
      const changes: Array<{ result: TraySiteResult; name: string; before: ServiceStatus['state'] }> = [];

      for (const result of results) {
        const asset = current.assets.find((item) => item.id === result.id && item.type === 'website');
        if (!asset) continue;
        const before = previous[result.id];
        const checkedAt = typeof result.checkedAt === 'number' ? result.checkedAt : Date.now();
        const statusCode = typeof result.statusCode === 'number' ? result.statusCode : null;
        const latencyMs = typeof result.latencyMs === 'number' ? result.latencyMs : null;
        const history = [
          ...(before?.website?.history ?? []),
          { t: checkedAt, ok: result.state !== 'offline', ms: latencyMs },
        ].slice(-30);
        next[result.id] = {
          assetId: result.id,
          checkedAt,
          state: result.state,
          latencyMs,
          summary:
            statusCode !== null
              ? `HTTP ${statusCode}${latencyMs !== null ? ` · ${latencyMs} ms` : ''}`
              : (result.error ?? ''),
          error: result.error ?? null,
          website: {
            statusCode,
            sslExpiresAt: before?.website?.sslExpiresAt ?? null,
            history,
          },
        };
        if (before && before.state !== result.state) {
          changes.push({ result, name: asset.name, before: before.state });
        }
      }

      if (!Object.keys(next).length) return;
      applyServiceStatuses(next);

      for (const change of changes) {
        const code = change.result.statusCode;
        const httpLine = code !== null
          ? translate('{name} · HTTP {status}', { name: change.name, status: String(code) })
          : translate('{name} yanıt vermiyor.', { name: change.name });
        if (
          change.result.state === 'offline' &&
          (change.before === 'online' || change.before === 'degraded')
        ) {
          notify(translate('Site çevrimdışı'), httpLine);
        } else if (
          change.result.state === 'online' &&
          (change.before === 'offline' || change.before === 'degraded')
        ) {
          notify(translate('Site yeniden çevrimiçi'), translate('{name} yanıt veriyor.', { name: change.name }));
        } else if (change.result.state === 'degraded' && change.before === 'online') {
          notify(translate('Site sorunlu'), httpLine);
        }
      }

      const merged = { ...previous, ...next };
      const checkedAt = results.reduce((latest, result) => {
        const value = typeof result.checkedAt === 'number' ? result.checkedAt : 0;
        return Math.max(latest, value);
      }, 0);
      sendTraySummary(current, merged, checkedAt);
      const state = readAgentState();
      state.lastSitesAt = Date.now();
      writeAgentState(state);
    },
    [notify],
  );

  const handleBotResults = useCallback(
    (results: TrayBotResult[]) => {
      botPendingRef.current = false;
      const current = dataRef.current;
      const translate = tRef.current;
      const previous = statusesRef.current;
      const next: Record<string, ServiceStatus> = {};
      const clearIds: string[] = [];
      const changes: Array<{
        result: TrayBotResult;
        name: string;
        before: ServiceStatus['state'];
      }> = [];
      const hints = readBotHints();
      let hintsChanged = false;

      for (const result of results) {
        const asset = current.assets.find(
          (item) => item.id === result.assetId && item.type === 'discord',
        );
        if (!asset) continue;

        const hint = typeof result.hint === 'string' && result.hint ? result.hint : null;
        if (hint && hints[asset.id] !== hint) {
          hints[asset.id] = hint;
          hintsChanged = true;
        } else if (!hint && hints[asset.id]) {
          delete hints[asset.id];
          hintsChanged = true;
        }

        if (result.configured === false) {
          clearIds.push(asset.id);
          continue;
        }
        if (
          result.state !== 'online' &&
          result.state !== 'degraded' &&
          result.state !== 'offline'
        ) {
          continue;
        }

        const before = previous[asset.id];
        const checkedAt = typeof result.checkedAt === 'number' ? result.checkedAt : Date.now();
        const source = result.discord ?? {};
        const guilds = Array.isArray(source.guilds)
          ? source.guilds
              .filter(
                (guild): guild is TrayBotGuild =>
                  Boolean(guild) && typeof guild.id === 'string',
              )
              .slice(0, 200)
              .map((guild) => ({
                id: guild.id,
                name: typeof guild.name === 'string' && guild.name ? guild.name : guild.id,
              }))
          : [];
        const guildCount =
          typeof source.guildCount === 'number' ? source.guildCount : guilds.length;

        next[asset.id] = {
          assetId: asset.id,
          checkedAt,
          state: result.state,
          latencyMs: typeof result.latencyMs === 'number' ? result.latencyMs : null,
          summary: typeof result.summary === 'string' ? result.summary : '',
          error: typeof result.error === 'string' ? result.error : null,
          discord:
            typeof source.botId === 'string' || typeof source.username === 'string'
              ? {
                  botId: typeof source.botId === 'string' ? source.botId : '',
                  username: typeof source.username === 'string' ? source.username : asset.name,
                  guildCount,
                  guilds,
                }
              : undefined,
        };
        if (before && before.state !== result.state) {
          changes.push({ result, name: asset.name, before: before.state });
        }
      }

      if (hintsChanged) writeBotHints(hints);
      if (clearIds.length) clearServiceStatuses(clearIds);
      if (Object.keys(next).length) applyServiceStatuses(next);

      for (const change of changes) {
        if (
          change.result.state === 'offline' &&
          (change.before === 'online' || change.before === 'degraded')
        ) {
          notify(
            translate('Bot çevrimdışı'),
            translate('{name} yanıt vermiyor.', { name: change.name }),
          );
        } else if (
          change.result.state === 'online' &&
          (change.before === 'offline' || change.before === 'degraded')
        ) {
          notify(
            translate('Bot yeniden çevrimiçi'),
            translate('{name} yanıt veriyor.', { name: change.name }),
          );
        } else if (change.result.state === 'degraded' && change.before === 'online') {
          notify(
            translate('Bot sorunlu'),
            translate('{name} yanıt veriyor.', { name: change.name }),
          );
        }
      }

      const merged = { ...previous, ...next };
      for (const id of clearIds) delete merged[id];
      const checkedAt = results.reduce((latest, result) => {
        const value = typeof result.checkedAt === 'number' ? result.checkedAt : 0;
        return Math.max(latest, value);
      }, 0);
      sendTraySummary(current, merged, checkedAt);
      const state = readAgentState();
      state.lastBotsAt = Date.now();
      writeAgentState(state);
    },
    [notify],
  );

  const runTick = useCallback(
    (options?: TrayTickOptions) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const now = Date.now();
        const currentDate = new Date();
        const today = localDateStamp(currentDate);
        const hour = currentDate.getHours();
        const force = Boolean(options?.force);
        const current = dataRef.current;
        const translate = tRef.current;
        const state = readAgentState();

        if (
          !sitePendingRef.current &&
          (force || now - (state.lastSitesAt ?? 0) >= SITE_INTERVAL_MS)
        ) {
          const targets = siteTargets(current);
          if (targets.length) {
            sitePendingRef.current = true;
            const sent = sendToTrayHost({
              kind: 'check-sites',
              sites: targets,
              requestedAt: now,
            });
            if (!sent) {
              sitePendingRef.current = false;
            } else {
              window.setTimeout(() => {
                sitePendingRef.current = false;
              }, 45000);
            }
          }
        }

        if (
          !botPendingRef.current &&
          (force || now - (state.lastBotsAt ?? 0) >= BOT_INTERVAL_MS)
        ) {
          const bots = botTargets(current);
          if (bots.length) {
            botPendingRef.current = true;
            const sent = sendToTrayHost({
              kind: 'check-bots',
              bots,
              requestedAt: now,
            });
            if (!sent) {
              botPendingRef.current = false;
            } else {
              window.setTimeout(() => {
                botPendingRef.current = false;
              }, 45000);
            }
          }
        }

        if (hour >= REMINDER_HOUR && state.lastReminderDate !== today) {
          const open = current.tasks.filter((task) => !task.done);
          const dueToday = open.filter((task) => task.due === today).length;
          const overdue = open.filter((task) => task.due && task.due < today).length;
          if (dueToday || overdue) {
            let body = translate('{count} görevin süresi geçti.', { count: String(overdue) });
            if (dueToday && overdue) {
              body = translate('Bugün {today} görev var; {overdue} görev gecikti.', {
                today: String(dueToday),
                overdue: String(overdue),
              });
            } else if (dueToday) {
              body = translate('Bugün {count} görevin süresi doluyor.', {
                count: String(dueToday),
              });
            }
            notify(translate('Görev hatırlatıcısı'), body);
            state.lastReminderDate = today;
            writeAgentState(state);
          }
        }

        const hasData =
          current.companies.length > 0 ||
          current.assets.length > 0 ||
          current.tasks.length > 0 ||
          current.notes.length > 0 ||
          current.finance.length > 0;
        if (
          hasData &&
          (force || hour >= BACKUP_HOUR) &&
          state.lastBackupDate !== today &&
          !backupPendingRef.current
        ) {
          backupPendingRef.current = true;
          const sent = sendToTrayHost({
            kind: 'backup',
            date: today,
            json: JSON.stringify(exportPayload()),
          });
          if (!sent) {
            backupPendingRef.current = false;
          } else {
            window.setTimeout(() => {
              backupPendingRef.current = false;
            }, 30000);
          }
        }

        if (force || now - (state.lastRatesAt ?? 0) >= RATES_INTERVAL_MS) {
          state.lastRatesAt = now;
          writeAgentState(state);
          const api = window.ezwin;
          if (api) void api.rates.refresh().catch(() => {});
        }
      } finally {
        busyRef.current = false;
      }
    },
    [notify],
  );

  runTickRef.current = runTick;

  useEffect(() => {
    if (!getTrayHost()) return;
    const off = onTrayHostMessage((message: TrayHostMessage) => {
      if (message.kind === 'site-results' && Array.isArray(message.results)) {
        const results = message.results.filter(isSiteResult);
        if (results.length) handleSiteResults(results);
        return;
      }
      if (message.kind === 'bot-results' && Array.isArray(message.results)) {
        const results = message.results.filter(isBotResult);
        if (results.length) handleBotResults(results);
        return;
      }
      if (message.kind === 'backup-saved') {
        backupPendingRef.current = false;
        if (message.ok === true) {
          const state = readAgentState();
          state.lastBackupDate =
            typeof message.date === 'string' ? message.date : localDateStamp();
          writeAgentState(state);
          sendToTrayHost({
            kind: 'backup-status',
            text: `Son yedek: ${formatClock(Date.now())}`,
          });
        } else {
          const today = localDateStamp();
          const state = readAgentState();
          if (state.lastBackupFailureDate !== today) {
            state.lastBackupFailureDate = today;
            writeAgentState(state);
            notify(tRef.current('Günlük yedek kaydedilemedi.'), '');
          }
        }
        return;
      }
      if (message.kind === 'host-ready') {
        requestBotSecretStatus();
        window.setTimeout(() => runTickRef.current({ source: 'host-ready' }), 500);
      }
    });

    const tick = (options?: TrayTickOptions) => runTickRef.current(options);
    window.__ezwinTrayTick = tick;
    requestBotSecretStatus();
    const startup = window.setTimeout(() => tick({ source: 'startup' }), 1200);
    return () => {
      window.clearTimeout(startup);
      off();
      if (window.__ezwinTrayTick === tick) delete window.__ezwinTrayTick;
    };
  }, [handleBotResults, handleSiteResults, notify]);

  return null;
}
