import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Remember where you were on each page, and put you back there when you go
 * back.
 *
 * Without this, returning from a workout drops you at the top of the Routines
 * list — which reads as "it didn't take me back to the page I was on" even
 * though the route is right. React Router only ships <ScrollRestoration> for
 * data routers; this app uses <BrowserRouter>, so it's done by hand.
 *
 * Keyed on `location.key`, which React Router mints per history ENTRY and
 * keeps across a pop. The obvious alternative, `history.state.idx`, is a
 * position in the stack and gets reused: go back twice and walk forward down a
 * different branch and the new pages inherit idx 1, 2, 3 — along with the
 * scroll positions of the pages that used to live there.
 *
 * Kept in memory only. A reload starts a fresh set of keys, and restoring a
 * position onto a list whose contents have changed would land you somewhere
 * arbitrary.
 */
const positions = new Map<string, number>();

/** Plenty for a session's browsing; keeps a long session from growing forever. */
const MAX_ENTRIES = 60;

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = location.key;

  // The browser also restores scroll on reload and on its own history
  // traversals, which fights this and produces a visible double-jump. Ours is
  // the one that knows about React rendering, so it wins.
  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Record continuously rather than on unmount: by the time a cleanup runs the
  // location has already changed, so the position would be filed under the
  // page being navigated TO.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (positions.size >= MAX_ENTRIES && !positions.has(key)) {
          // Map preserves insertion order, so the first key is the oldest.
          const oldest = positions.keys().next().value;
          if (oldest !== undefined) positions.delete(oldest);
        }
        positions.set(key, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
      return;
    }
    const target = positions.get(key);
    if (target == null) {
      window.scrollTo(0, 0);
      return;
    }
    // These pages fetch before they render, so the document is often a short
    // skeleton for the first few frames and a single scrollTo lands at the
    // bottom of it. Keep trying until the page is tall enough — or until it's
    // clear it never will be — and don't let the short landings overwrite the
    // saved position on the way.
    let frame = 0;
    let tries = 0;
    const settle = () => {
      window.scrollTo(0, target);
      tries += 1;
      const reached = Math.abs(window.scrollY - target) <= 1;
      if (!reached && tries < 30) {
        frame = requestAnimationFrame(settle);
      } else {
        positions.set(key, target);
      }
    };
    frame = requestAnimationFrame(settle);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key, navigationType]);
}
