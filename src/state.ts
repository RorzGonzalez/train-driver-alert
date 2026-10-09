import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SeenEntry {
  firstSeen: string;
  lastSeen: string;
  title: string;
  location: string | null;
  url: string;
  sent: boolean;
  reason?: string;
}

export interface State {
  seen: Record<string, SeenEntry>;
  failures: Record<string, { count: number; notified: boolean }>;
  /** Last successful fetch per company, for companies polled less often. */
  lastFetched: Record<string, string>;
}

export function emptyState(): State {
  return { seen: {}, failures: {}, lastFetched: {} };
}

export function loadState(path: string): State {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<State>;
    return { seen: parsed.seen ?? {}, failures: parsed.failures ?? {}, lastFetched: parsed.lastFetched ?? {} };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
    throw err;
  }
}

export function saveState(path: string, state: State): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, path);
}
