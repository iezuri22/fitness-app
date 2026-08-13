/**
 * Manual "check for updates" for the installed PWA.
 *
 * The service worker is registered with `registerType: 'autoUpdate'`, so a new
 * build normally activates on the next cold start. But an app kept open (or
 * parked on the iOS home screen) can serve stale assets for a long time — this
 * gives the user a button to force the newest deploy immediately.
 *
 * How it works: ask every registration to re-check the server. Every build
 * emits a new `sw.js` (served `max-age=0, must-revalidate`), so if a deploy has
 * happened the browser finds a different worker, installs it — which precaches
 * the new assets — and it self-activates via skipWaiting + clientsClaim. We
 * wait for that to finish, then reload, so the reload is answered by the new
 * worker and its fresh precache.
 *
 * Deliberately does NOT delete caches. An earlier version wiped everything
 * except the demo cache first, which looked like belt-and-braces but had a
 * real cost: workbox only populates the precache during `install`, so if you
 * were already on the newest build no new worker installed, nothing repopulated
 * it, and the app silently lost offline launch until the next deploy. Letting
 * the incoming worker replace the precache is both sufficient and safe — a
 * stale shell can't survive a new worker activating.
 *
 * The exercise-demo cache is untouched for the same reason it always was:
 * those files are content-addressed and can total ~100MB.
 */
export const DEMO_CACHE = "exercise-demos";

/** Give up waiting on a worker that stalls, rather than hanging the button. */
const ACTIVATION_TIMEOUT_MS = 8000;

export async function forceRefresh(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (r) => {
          await r.update().catch(() => {});
          const incoming = r.installing ?? r.waiting;
          if (!incoming) return; // already current — nothing to wait for
          await waitForActivation(incoming);
        })
      );
    }
  } catch {
    // Any failure here still falls through to the reload below — a plain
    // reload is strictly better than leaving the user on the old build.
  } finally {
    window.location.reload();
  }
}

function waitForActivation(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    const settled = () => {
      // "redundant" means it was superseded or failed; either way, stop waiting.
      if (worker.state === "activated" || worker.state === "redundant") {
        worker.removeEventListener("statechange", settled);
        resolve();
      }
    };
    worker.addEventListener("statechange", settled);
    settled(); // it may already be there
    setTimeout(resolve, ACTIVATION_TIMEOUT_MS);
  });
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
