/**
 * Manual "check for updates" for the installed PWA.
 *
 * The service worker is registered with `registerType: 'autoUpdate'`, so a new
 * build normally activates on the next cold start. But an app kept open (or
 * parked on the iOS home screen) can serve stale assets for a long time — this
 * gives the user a button to force the newest deploy immediately.
 *
 * Steps: ask every registration to re-check the server, nudge any worker stuck
 * in `waiting`, drop the precache so the reload can't be answered from stale
 * entries, then reload. Cache-clearing is skipped when offline so an offline
 * tap can't leave the app with no assets to boot from.
 *
 * The exercise-demo cache is deliberately preserved — those files are named
 * immutably and can total ~100MB, so wiping them would silently cost the user
 * their offline demos (and a big re-download) every time they check for an app
 * update.
 */
export const DEMO_CACHE = "exercise-demos";

export async function forceRefresh(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
      for (const r of regs) {
        r.waiting?.postMessage({ type: "SKIP_WAITING" });
      }
    }
    if ("caches" in window && navigator.onLine) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(DEMO_CACHE)).map((k) => caches.delete(k))
      );
    }
  } catch {
    // Any failure here still falls through to the reload below — a plain
    // reload is strictly better than leaving the user on the old build.
  } finally {
    // `reload()` ignores its old forceGet arg in modern browsers; the cache
    // clear above is what actually guarantees fresh assets.
    window.location.reload();
  }
}

/** Human-readable build stamp, e.g. "Aug 4, 2026, 2:31 PM". */
export function buildDateLabel(): string {
  try {
    return new Date(__BUILD_DATE__).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "unknown";
  }
}
