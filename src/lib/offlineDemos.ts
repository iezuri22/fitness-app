/**
 * Offline availability for exercise demos.
 *
 * The service worker caches demos with a CacheFirst rule, but that only covers
 * files you've already *looked at* — scroll past an exercise and its demo was
 * never fetched, so it's missing the moment you lose signal. Gym wifi being
 * what it is, that's most of the time.
 *
 * So we warm the cache ahead of time: opening a workout prefetches every demo
 * in it, and Settings can preload a whole week. Fetching is all it takes — the
 * SW route stores the response on the way through.
 */
import { findGifForName, secondFrameUrl } from "./exerciseGifs";
import type { PlannedSet, Workout } from "./types";

export const DEMO_CACHE = "exercise-demos";

/** Every demo URL a set list needs, including both frames of 2-frame demos. */
export function demoUrlsForSets(
  sets: PlannedSet[],
  gifByExerciseId?: Map<string, string | undefined>
): string[] {
  const urls = new Set<string>();
  for (const s of sets) {
    const explicit = gifByExerciseId?.get(s.exerciseId);
    const url = explicit || findGifForName(s.exerciseName);
    if (!url) continue;
    urls.add(url);
    const second = secondFrameUrl(url);
    if (second) urls.add(second);
  }
  return [...urls];
}

/** Same, across a batch of workouts. */
export function demoUrlsForWorkouts(workouts: Workout[]): string[] {
  const urls = new Set<string>();
  for (const w of workouts) {
    for (const u of demoUrlsForSets(w.plannedSets ?? [])) urls.add(u);
  }
  return [...urls];
}

/**
 * Every demo in the whole exercise library — what "save everything offline"
 * actually means. Scoping this to planned workouts only was too clever: swap a
 * workout at the gym and the demo you need was never saved.
 */
export function demoUrlsForLibrary(
  library: { id: string; name: string; gifUrl?: string }[]
): string[] {
  const urls = new Set<string>();
  for (const ex of library) {
    const url = ex.gifUrl || findGifForName(ex.name);
    if (!url) continue;
    urls.add(url);
    const second = secondFrameUrl(url);
    if (second) urls.add(second);
  }
  return [...urls];
}

/** Rough download size, for telling the user what they're about to pull. */
export async function estimateBytes(urls: string[]): Promise<number | null> {
  // Sample a handful with HEAD requests and extrapolate — 400 HEADs would be
  // slower than just downloading some of them.
  const sample = urls.slice(0, 8);
  if (!sample.length) return null;
  try {
    const sizes = await Promise.all(
      sample.map(async (u) => {
        const r = await fetch(u, { method: "HEAD" });
        const len = r.headers.get("content-length");
        return len ? Number(len) : null;
      })
    );
    const known = sizes.filter((n): n is number => typeof n === "number" && n > 0);
    if (!known.length) return null;
    const avg = known.reduce((a, b) => a + b, 0) / known.length;
    return Math.round(avg * urls.length);
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

/** How many of these URLs are already stored. */
export async function countCached(urls: string[]): Promise<number> {
  if (!("caches" in window) || !urls.length) return 0;
  try {
    const cache = await caches.open(DEMO_CACHE);
    const hits = await Promise.all(urls.map((u) => cache.match(u)));
    return hits.filter(Boolean).length;
  } catch {
    return 0;
  }
}

/**
 * Fetch each URL so the service worker stores it. Skips anything already
 * cached, runs a few at a time to avoid hammering the connection, and never
 * throws — a failed prefetch just means that demo loads later, online.
 */
export async function prefetchDemos(
  urls: string[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<{ cached: number; failed: number }> {
  if (!urls.length) return { cached: 0, failed: 0 };
  const { concurrency = 4, onProgress } = opts;

  let cache: Cache | null = null;
  try {
    if ("caches" in window) cache = await caches.open(DEMO_CACHE);
  } catch {
    cache = null;
  }

  // Only fetch what's missing.
  const missing: string[] = [];
  for (const u of urls) {
    if (cache && (await cache.match(u))) continue;
    missing.push(u);
  }

  let done = 0;
  let failed = 0;
  onProgress?.(0, missing.length);

  const queue = [...missing];
  async function worker() {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      try {
        const res = await fetch(url, { cache: "no-cache" });
        // Store explicitly too: if the SW isn't controlling this page yet
        // (first load after install) the route wouldn't have run.
        if (cache && res.ok) await cache.put(url, res.clone());
        if (!res.ok) failed++;
      } catch {
        failed++;
      } finally {
        done++;
        onProgress?.(done, missing.length);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker)
  );
  return { cached: done - failed, failed };
}

/** Fire-and-forget warm-up. Used when a workout screen opens. */
export function prefetchInBackground(urls: string[]): void {
  if (!urls.length || !navigator.onLine) return;
  void prefetchDemos(urls, { concurrency: 3 });
}
