const SCOPE_KEY = 'ezwin.hub.web.scope.v1';
const OWNER_KEY = 'ezwin.hub.web.workspace.owner.v1';
const LEGACY_KEYS = ['ezwin.hub.web.v1', 'ezwin.hub.web.sync.v1'];

let activeScope: string | null = null;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getWorkspaceScope(): string {
  if (activeScope === null) activeScope = read(SCOPE_KEY) || 'local';
  return activeScope;
}

export function setWorkspaceScope(scope: string): void {
  activeScope = scope || 'local';
  try {
    localStorage.setItem(SCOPE_KEY, activeScope);
  } catch {
    /* the in-memory scope still isolates this session */
  }
}

export function getLegacyWorkspaceOwner(): string | null {
  return read(OWNER_KEY);
}

export function claimLegacyWorkspace(accountId: string): void {
  if (read(OWNER_KEY)) return;
  try {
    localStorage.setItem(OWNER_KEY, accountId);
  } catch {
    /* unscoped fallback keeps legacy data reachable */
  }
}

export function releaseLegacyWorkspace(accountId: string): void {
  if (read(OWNER_KEY) !== accountId) return;
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
}

export function hasLegacyWorkspaceData(): boolean {
  return LEGACY_KEYS.some((key) => read(key) !== null);
}

export function scopedStorageKey(base: string): string {
  const scope = getWorkspaceScope();
  if (scope === 'local') return base;
  const owner = getLegacyWorkspaceOwner();
  if (owner && scope === owner) return base;
  if (!owner && scope === 'guest') return base;
  return `${base}::${scope}`;
}
