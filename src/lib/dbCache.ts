/**
 * In-memory read cache for the hot Firestore collections.
 *
 * Nine screens call `listExercises` and most call `listTemplates`, so every tab
 * switch was re-downloading the whole library — a few hundred documents — before
 * it could render anything. None of that data changes between two taps.
 *
 * Three behaviours, all of which matter:
 *   · Fresh entries are returned synchronously-ish, so a revisit is instant.
 *   · Concurrent callers share one request. Library asks for exercises and
 *     templates at the same moment as its child components; without this that's
 *     several identical round trips.
 *   · Writes invalidate by prefix, so the next read is authoritative. TTL alone
 *     would show stale data right after an edit, which is worse than slow.
 *
 * Deliberately not persisted. This is a per-session speed-up, not an offline
 * layer — the service worker already handles offline for assets, and stale
 * workout data surviving a reload would be a correctness problem.
 */

type Entry = { data: unknown; at: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** Long enough to cover a session of tab-switching; writes invalidate anyway. */
export const DEFAULT_TTL_MS = 5 * 60_000;

/**
 * Hit/miss tally. Exposed on `window.__dbCache` in dev only (stripped from
 * production builds) so cache behaviour can be checked from the console
 * instead of inferred from how fast a screen feels.
 */
export const stats = { hits: 0, misses: 0, coalesced: 0 };
if (import.meta.env.DEV) {
  (globalThis as unknown as { __dbCache?: typeof stats }).__dbCache = stats;
}

export async function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    stats.hits += 1;
    return hit.data as T;
  }

  const pending = inflight.get(key);
  if (pending) {
    stats.coalesced += 1;
    return pending as Promise<T>;
  }
  stats.misses += 1;

  const p = load()
    .then((data) => {
      store.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/**
 * Drop every entry whose key starts with `prefix`. Called from writes — keys
 * are built as `<collection>:<uid>[:extra]`, so `invalidate("workouts:uid")`
 * clears all the range queries for that user too.
 */
export function invalidate(prefix: string): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

/** Synchronous peek — lets a page paint from cache on its very first render. */
export function peekCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | undefined {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  return undefined;
}

/** Cache keys, in one place so reads and invalidations can't drift apart. */
export const cacheKey = {
  exercises: (uid: string) => `exercises:${uid}`,
  templates: (uid: string) => `templates:${uid}`,
  workouts: (uid: string) => `workouts:${uid}`,
  workoutRange: (uid: string, start: string, end: string) =>
    `workouts:${uid}:range:${start}:${end}`,
  workoutList: (uid: string, limit: number) => `workouts:${uid}:list:${limit}`,
};
