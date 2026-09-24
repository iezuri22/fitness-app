/**
 * Read cache for the hot Firestore reads: paint from what's on the phone, then
 * refresh from the server in the background.
 *
 * Every cold open used to wait on the network for everything — the library,
 * the templates, the week's workouts — before a single screen could paint,
 * and on a gym's LTE that is seconds. Firestore now keeps its data in
 * IndexedDB (see firebase.ts), so a read can be answered from the phone in a
 * few milliseconds while the server is asked in parallel.
 *
 * The rules:
 *   · Memory first. A fresh entry is returned as-is.
 *   · A stale entry (older than the TTL, or answered from the device cache) is
 *     returned immediately and refreshed in the background.
 *   · On a miss, the device cache is tried first. An empty answer from it
 *     counts as "don't know" — the server decides.
 *   · When a background refresh brings back something different, subscribers
 *     hear about it (see useDataVersion) so a list page can re-read and show
 *     it. Pages that hold edits in progress — the workout runner — don't
 *     subscribe. They read the workout itself with getDoc: the server when
 *     online, and offline the phone's copy, which holds your own unsynced sets.
 *   · Concurrent callers share one request.
 *   · Writes invalidate by prefix, and a request that was already in flight
 *     when the write happened can't put its older answer back. Subscribers are
 *     still told, so a page painted from before the write re-reads after it.
 *   · Showing isn't deciding. Anything that writes from what it read, or
 *     decides from it (planning a week, recording a preference, importing
 *     without duplicates) asks for { fresh: true }: an answer the server has
 *     confirmed, not whatever the phone happened to have.
 *   · Offline, Firestore answers a "server" read from the phone. That answer is
 *     kept but not trusted: it stays stale, so the first read after the
 *     connection returns asks again.
 */

export type Source = "server" | "cache";
/** A loader sets fromCache when Firestore answered a server read from the phone (offline). */
export type LoadNote = { fromCache: boolean };
export type Loader<T> = (from: Source, note: LoadNote) => Promise<T>;
/** confirmed = came from the server, not from the phone's copy. */
type Entry = { data: unknown; at: number; json: string; confirmed: boolean };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
/** Bumped by invalidate(). A load only lands if its key's generation is unchanged. */
const generation = new Map<string, number>();
/** Keys with a device-cache read under way, so invalidate() can reach those too. */
const reading = new Map<string, number>();

/** Long enough to cover a session of tab-switching; writes invalidate anyway. */
export const DEFAULT_TTL_MS = 5 * 60_000;

/**
 * Hit/miss tally. Exposed on `window.__dbCache` in dev only (stripped from
 * production builds) so cache behaviour can be checked from the console
 * instead of inferred from how fast a screen feels.
 */
export const stats = { hits: 0, stale: 0, device: 0, misses: 0, coalesced: 0, refreshed: 0 };
if (import.meta.env.DEV) {
  (globalThis as unknown as { __dbCache?: typeof stats }).__dbCache = stats;
}

/* ------------------------------ change feed ------------------------------ */

const listeners = new Set<(key: string) => void>();

/** Called with the key whenever a background refresh changed what a read returns. */
export function subscribe(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(key: string) {
  for (const fn of listeners) fn(key);
}

/* --------------------------------- reads --------------------------------- */

const gen = (key: string) => generation.get(key) ?? 0;

function put(key: string, data: unknown, at: number, confirmed: boolean): { changed: boolean } {
  const json = JSON.stringify(data) ?? "";
  const prev = store.get(key);
  store.set(key, { data, at, json, confirmed });
  return { changed: prev !== undefined && prev.json !== json };
}

/** Ask the server, share the request, and land the answer only if nothing was written meanwhile. */
function fromServer<T>(key: string, load: Loader<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) {
    stats.coalesced += 1;
    return pending as Promise<T>;
  }
  const g = gen(key);
  const note: LoadNote = { fromCache: false };
  const p = load("server", note)
    .then((data) => {
      if (gen(key) === g) {
        // Offline, the "server" answer is the phone's copy: keep it, but stale.
        const confirmed = !note.fromCache;
        const { changed } = put(key, data, confirmed ? Date.now() : 0, confirmed);
        if (changed) {
          stats.refreshed += 1;
          emit(key);
        }
      } else {
        // A write landed while this was in flight, so this answer predates it
        // and is dropped. Whoever painted the older view still needs to hear
        // about it: their re-read now reflects the write.
        emit(key);
      }
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** Refresh without making anyone wait; a failure just leaves the cached answer. */
function refresh<T>(key: string, load: Loader<T>) {
  fromServer(key, load).catch((e) => console.warn(`[dbCache] refresh ${key} failed:`, e));
}

/**
 * Something from the device cache that's worth showing. For a query, empty
 * means "unknown" — the device may just never have fetched it. A single
 * document the device can answer for at all (trustEmpty) is known, even if
 * the answer is "it doesn't exist yet".
 */
function usable(data: unknown, trustEmpty: boolean): boolean {
  if (trustEmpty) return true;
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data as object).length > 0;
  return true;
}

export async function cachedRead<T>(
  key: string,
  load: Loader<T>,
  {
    ttlMs = DEFAULT_TTL_MS,
    trustEmpty = false,
    fresh = false,
  }: { ttlMs?: number; trustEmpty?: boolean; fresh?: boolean } = {}
): Promise<T> {
  const hit = store.get(key);
  if (fresh) {
    if (hit?.confirmed && Date.now() - hit.at < ttlMs) {
      stats.hits += 1;
      return hit.data as T;
    }
    stats.misses += 1;
    return fromServer(key, load);
  }
  if (hit) {
    if (Date.now() - hit.at < ttlMs) {
      stats.hits += 1;
    } else {
      stats.stale += 1;
      refresh(key, load);
    }
    return hit.data as T;
  }

  // Nothing in memory: the device cache answers in milliseconds if it can.
  if (!inflight.has(key)) {
    const g = gen(key);
    let local: T | undefined;
    reading.set(key, (reading.get(key) ?? 0) + 1);
    try {
      local = await load("cache", { fromCache: true });
    } catch {
      // Not cached on this device — fall through to the server.
    } finally {
      const n = (reading.get(key) ?? 1) - 1;
      if (n) reading.set(key, n);
      else reading.delete(key);
    }
    // A concurrent caller may have filled it while we read.
    const filled = store.get(key);
    if (filled) return filled.data as T;
    if (local !== undefined && usable(local, trustEmpty) && gen(key) === g) {
      stats.device += 1;
      put(key, local, 0, false); // at 0 = stale, so reads keep refreshing until the server answers
      refresh(key, load);
      return local as T;
    }
  }
  stats.misses += 1;
  return fromServer(key, load);
}

/**
 * Drop every entry whose key starts with `prefix`. Called from writes — keys
 * are built as `<collection>:<uid>[:extra]`, so `invalidate("workouts:uid")`
 * clears all the range queries for that user too.
 */
export function invalidate(prefix: string): void {
  const keys = new Set([...store.keys(), ...inflight.keys(), ...reading.keys()]);
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    store.delete(key);
    inflight.delete(key);
    generation.set(key, gen(key) + 1);
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
  signals: (uid: string) => `signals:${uid}`,
  goals: (uid: string) => `goals:${uid}`,
  supplements: (uid: string) => `supplements:${uid}`,
  supplementLog: (uid: string, date: string) => `supplements:${uid}:log:${date}`,
  supplementLogs: (uid: string, start: string, end: string) =>
    `supplements:${uid}:logs:${start}:${end}`,
};
