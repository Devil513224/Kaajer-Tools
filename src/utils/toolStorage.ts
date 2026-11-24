const RECENT_KEY = 'kaajer-recent-tools';
const FAVORITES_KEY = 'kaajer-favorite-tools';
const MAX_RECENT = 6;

function safeReadArray(key: string): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function safeWriteArray(key: string, items: string[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota or blocked storage errors cleanly
  }
}

export function getRecentToolIds(): string[] {
  return safeReadArray(RECENT_KEY).slice(0, MAX_RECENT);
}

export function recordRecentToolId(toolId: string): string[] {
  const prev = getRecentToolIds().filter((id) => id !== toolId);
  const next = [toolId, ...prev].slice(0, MAX_RECENT);
  safeWriteArray(RECENT_KEY, next);
  return next;
}

export function clearRecentTools(): string[] {
  safeWriteArray(RECENT_KEY, []);
  return [];
}

export function getFavoriteToolIds(): string[] {
  return safeReadArray(FAVORITES_KEY);
}

export function toggleFavoriteToolId(toolId: string): string[] {
  const prev = getFavoriteToolIds();
  const exists = prev.includes(toolId);
  const next = exists ? prev.filter((id) => id !== toolId) : [toolId, ...prev];
  safeWriteArray(FAVORITES_KEY, next);
  return next;
}

export function clearFavoriteTools(): string[] {
  safeWriteArray(FAVORITES_KEY, []);
  return [];
}
