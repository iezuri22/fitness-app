/**
 * Every screen except Today, as its own chunk — and loaded so that splitting
 * them doesn't cost a frame.
 *
 * Opening the app used to download, parse and run the code for all twenty
 * screens before drawing the one you opened. Now each is its own chunk. The
 * catch with React.lazy is that a screen which suspends is held back by React
 * for at least 300 ms once its loading state shows, so plain lazy() made every
 * split screen slower to reopen than the single bundle was. Two things avoid it:
 *
 *   · main.tsx waits for the opened screen's chunk before the first render —
 *     tens of milliseconds from the service worker, capped so a missing chunk
 *     can't hang startup.
 *   · A screen whose chunk has already loaded renders directly, without going
 *     through lazy() and Suspense at all.
 *
 * Tabs warm their chunk on touch, and the main screens are loaded one at a
 * time once the phone is idle. Navigation between screens runs as a React
 * transition, so a screen that isn't loaded yet keeps the current one up
 * rather than flashing a skeleton. On an installed app all of it comes from
 * the service worker's copy, not the network.
 */
import { createElement, lazy, useState, type ComponentType } from "react";

type Module = { default: ComponentType };

/**
 * After a deploy, an open app can ask for a chunk that no longer exists. Reload
 * once to pick up the new build instead of leaving a blank screen; the flag
 * stops a loop if the chunk is genuinely broken.
 */
const RELOADED = "lift.chunk-reload";
function withReload(load: () => Promise<Module>): () => Promise<Module> {
  return () =>
    load().then(
      (m) => {
        try {
          sessionStorage.removeItem(RELOADED);
        } catch {
          // storage unavailable: nothing to clear
        }
        return m;
      },
      (e) => {
        let reloaded = true;
        try {
          reloaded = sessionStorage.getItem(RELOADED) === "1";
          if (!reloaded) sessionStorage.setItem(RELOADED, "1");
        } catch {
          // storage unavailable: don't risk a reload loop
        }
        if (!reloaded) {
          window.location.reload();
          return new Promise<Module>(() => {}); // the page is going away
        }
        throw e;
      }
    );
}

type Screen = ComponentType & { preload: () => Promise<unknown> };

function screen(importer: () => Promise<Module>): Screen {
  let loaded: ComponentType | null = null;
  let pending: Promise<unknown> | null = null;
  // Background loads never reload the page — only opening a screen may. A
  // warm-up that hit a stale build mid-workout mustn't yank the screen away.
  const preload = () =>
    (pending ??= importer().then(
      (m) => {
        loaded = m.default;
      },
      () => {
        pending = null; // let the next attempt retry
      }
    ));
  const Lazy = lazy(() => withReload(importer)().then((m) => ((loaded = m.default), m)));
  // Each mount keeps the path it started on. Switching from Lazy to the loaded
  // component on a later render would be a different element type to React —
  // a remount, and the screen's state gone.
  const Component = () => {
    const [direct] = useState(() => loaded);
    return createElement(direct ?? Lazy);
  };
  return Object.assign(Component, { preload });
}

export const Login = screen(() => import("./pages/Login"));
export const Signup = screen(() => import("./pages/Signup"));
export const Onboarding = screen(() => import("./pages/Onboarding"));
export const Plan = screen(() => import("./pages/Plan"));
export const Generate = screen(() => import("./pages/Generate"));
export const Recommend = screen(() => import("./pages/Recommend"));
export const Body = screen(() => import("./pages/Body"));
export const Vitamins = screen(() => import("./pages/Vitamins"));
export const ReviewTargets = screen(() => import("./pages/ReviewTargets"));
export const LogClass = screen(() => import("./pages/LogClass"));
export const Library = screen(() => import("./pages/Library"));
export const Planned = screen(() => import("./pages/Planned"));
export const WorkoutDetail = screen(() => import("./pages/WorkoutDetail"));
export const History = screen(() => import("./pages/History"));
export const Exercises = screen(() => import("./pages/Exercises"));
export const ExerciseDetail = screen(() => import("./pages/ExerciseDetail"));
export const NewWorkout = screen(() => import("./pages/NewWorkout"));
export const Settings = screen(() => import("./pages/Settings"));
export const Workout = screen(() => import("./pages/Workout"));

/** URL → the screen that draws it. First match wins, so specific paths come first. */
const ROUTES: Array<[RegExp, Screen]> = [
  [/^\/workout\/[^/]+\/review\/?$/, ReviewTargets],
  [/^\/workout\/[^/]+\/?$/, Workout],
  [/^\/(history|planned)\/[^/]+\/?$/, WorkoutDetail],
  [/^\/exercises\/[^/]+\/?$/, ExerciseDetail],
  [/^\/plan\/?$/, Plan],
  [/^\/library\/?$/, Library],
  [/^\/exercises\/?$/, Exercises],
  [/^\/vitamins\/?$/, Vitamins],
  [/^\/history\/?$/, History],
  [/^\/planned\/?$/, Planned],
  [/^\/settings\/?$/, Settings],
  [/^\/body(\/.*)?$/, Body],
  [/^\/generate\/?$/, Generate],
  [/^\/recommend\/?$/, Recommend],
  [/^\/log-class\/?$/, LogClass],
  [/^\/new\/?$/, NewWorkout],
  [/^\/login\/?$/, Login],
  [/^\/signup\/?$/, Signup],
  [/^\/welcome\/?$/, Onboarding],
];

/** Start loading the screen for a path. Resolves at once for Today, which is in the main bundle. */
export function preloadFor(path: string): Promise<unknown> {
  const pathname = path.split(/[?#]/)[0];
  return ROUTES.find(([re]) => re.test(pathname))?.[1].preload() ?? Promise.resolve();
}

/** The screens you move between most, loaded one per idle moment after the first paint. */
export function warmMainScreens(): () => void {
  const queue: Screen[] = [Plan, Library, Exercises, History, Vitamins, Workout, Settings];
  const idle = (cb: () => void) =>
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(cb, { timeout: 3000 })
      : window.setTimeout(cb, 400);
  const cancel = (id: number) =>
    typeof window.cancelIdleCallback === "function"
      ? window.cancelIdleCallback(id)
      : window.clearTimeout(id);
  let idleId = 0;
  let stopped = false;
  const next = () => {
    const s = queue.shift();
    if (!s || stopped) return;
    void s.preload().finally(() => {
      if (!stopped) idleId = idle(next);
    });
  };
  // Give the screen that's opening a head start before any of this.
  const timer = window.setTimeout(() => (idleId = idle(next)), 1500);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    if (idleId) cancel(idleId);
  };
}
