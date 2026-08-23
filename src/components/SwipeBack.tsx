import { useEffect, useRef, type ReactNode } from "react";
import { canGoBack } from "../hooks/useBack";

/**
 * Edge-swipe to go back, for the whole app.
 *
 * The manifest declares `display: "standalone"`, and an installed PWA on iOS
 * gets no native back gesture — which is why the app grew back chevrons. This
 * puts the gesture back: drag from the left edge and the page follows your
 * finger; let go past the threshold and it completes, otherwise it springs
 * back. Nothing is rendered behind, so the page slides off the app's own black
 * ground.
 *
 * Listeners live on `window`, not on the transformed element. The element is
 * inside `<main class="px-4">`, so its box starts 16px in — a finger at the
 * actual screen edge lands on <main> and would never reach a listener bound to
 * the child. Binding to the window means hit-testing can't swallow the very
 * pixels the gesture exists for.
 *
 * Rules that keep it from fighting the rest of the UI:
 *   · It only arms within EDGE_PX of the left edge, so it can't hijack a
 *     horizontal drag on a chip rail or the exercise-demo carousel.
 *   · It only arms when there is history to pop. Sliding a tab root off-screen
 *     to then replace() somewhere is a jarring way to say "nowhere to go".
 *   · The first few pixels decide the axis. A gesture that starts vertical is
 *     handed back to the scroller and never reconsidered, so a diagonal thumb
 *     flick down a long list can't turn into a navigation halfway through.
 *   · One finger only, tracked by identifier — a second touch can't complete
 *     or cancel a drag it didn't start.
 *   · It disarms while a modal is open.
 */

/** How close to the left edge a touch must start to arm the gesture. */
const EDGE_PX = 28;
/** Pixels of travel before we commit to an axis. */
const AXIS_PX = 8;
/** Fraction of the viewport that counts as "far enough to go back". */
const COMMIT_FRACTION = 0.35;
/**
 * A flick counts, but only if it actually went somewhere. Below this the
 * gesture springs back however fast it was — otherwise a brisk 60-pixel nudge
 * near the edge navigates, which is the difference between a gesture that
 * feels responsive and one that feels trigger-happy.
 */
const MIN_COMMIT_PX = 80;
/**
 * How far a flick is assumed to coast, in ms. Distance plus projected
 * momentum is compared against the threshold, so a short fast swipe completes
 * and a long slow drag still has to cross the line. Same idea as UIKit's
 * projected end position.
 */
const PROJECTION_MS = 120;
/** A velocity sample older than this is stale; treat the release as still. */
const VELOCITY_MAX_AGE_MS = 100;
/** Slide-off duration. The navigation waits for it so the pages don't cross. */
const COMMIT_MS = 200;

type Phase = "idle" | "deciding" | "dragging";

export default function SwipeBack({
  children,
  onBack,
  enabled = true,
}: {
  children: ReactNode;
  onBack: () => void;
  enabled?: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !enabled) return;

    let phase: Phase = "idle";
    let touchId: number | null = null;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    // Previous sample, for velocity over the final segment. Averaging across
    // the whole gesture would let a slow start mask a fast finish.
    let prevX = 0;
    let prevT = 0;
    let lastX = 0;
    let lastT = 0;
    let commitTimer = 0;

    const paint = (x: number, animate: boolean) => {
      surface.style.transition = animate
        ? `transform ${COMMIT_MS + 20}ms cubic-bezier(0.32, 0.72, 0, 1)`
        : "";
      surface.style.transform = x ? `translate3d(${x}px,0,0)` : "";
    };

    const disarm = () => {
      phase = "idle";
      touchId = null;
      dx = 0;
      surface.style.willChange = "";
    };

    /** The finger we're tracking, or null if this event isn't about it. */
    const tracked = (e: TouchEvent) => {
      if (touchId === null) return null;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId) return t;
      }
      return null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (phase !== "idle" || e.touches.length !== 1) return;
      // A sheet or full-screen timer is open — leave the gesture to it.
      if (document.querySelector('[role="dialog"]')) return;
      // Nothing to go back to: don't arm at all, rather than sliding the page
      // away and snapping it back.
      if (!canGoBack()) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      phase = "deciding";
      touchId = t.identifier;
      startX = t.clientX;
      startY = t.clientY;
      prevX = lastX = t.clientX;
      prevT = lastT = e.timeStamp;
      dx = 0;
      surface.style.willChange = "transform";
    };

    const onTouchMove = (e: TouchEvent) => {
      if (phase === "idle") return;
      // A second finger landed: this is a pinch or a two-finger scroll, not a
      // back gesture.
      if (e.touches.length > 1) {
        paint(0, true);
        return disarm();
      }
      const t = tracked(e) ?? e.touches[0];
      if (!t) return;
      const moveX = t.clientX - startX;
      const moveY = t.clientY - startY;

      if (phase === "deciding") {
        if (Math.abs(moveX) < AXIS_PX && Math.abs(moveY) < AXIS_PX) return;
        // Vertical wins: this is a scroll, and it stays a scroll.
        if (Math.abs(moveY) > Math.abs(moveX)) return disarm();
        phase = "dragging";
      }

      // Rightward only — dragging left would mean "forward", which we don't do.
      dx = Math.max(0, moveX);
      prevX = lastX;
      prevT = lastT;
      lastX = t.clientX;
      lastT = e.timeStamp;
      // Non-passive listener, so this actually suppresses the scroll under it.
      if (e.cancelable) e.preventDefault();
      paint(dx, false);
    };

    const onTouchEnd = (e: TouchEvent) => {
      // Ignore a finger that isn't the one driving this gesture.
      if (touchId !== null && !tracked(e)) return;
      if (phase !== "dragging") return disarm();

      const width = window.innerWidth || 1;
      const dt = lastT - prevT;
      const age = e.timeStamp - lastT;
      // Guard the sample: a zero interval yields no usable velocity, and a
      // stale one means the finger stopped before lifting — a deliberate
      // "put it back", which shouldn't read as a flick.
      const velocity =
        dt > 0 && age <= VELOCITY_MAX_AGE_MS ? (lastX - prevX) / dt : 0;
      const projected = dx + Math.max(0, velocity) * PROJECTION_MS;
      const commit = dx >= MIN_COMMIT_PX && projected > width * COMMIT_FRACTION;

      if (commit) {
        paint(width, true);
        // Let the slide finish before the route swaps, or the incoming page
        // appears mid-animation. Tracked so unmounting cancels it — otherwise
        // it navigates out of a screen the user has already left.
        commitTimer = window.setTimeout(() => {
          commitTimer = 0;
          surface.style.transition = "";
          surface.style.transform = "";
          surface.style.willChange = "";
          onBackRef.current();
        }, COMMIT_MS);
        // Keep willChange until the transition has actually run.
        phase = "idle";
        touchId = null;
        dx = 0;
      } else {
        paint(0, true);
        disarm();
      }
    };

    const onTouchCancel = () => {
      // The system took the gesture (call, notification, edge conflict). That
      // is an abort, not a release — springing back is the only safe reading.
      if (phase === "dragging") paint(0, true);
      disarm();
    };

    // Bound to the window so a touch in the outermost pixels — which land on
    // <main>, outside this element's padded box — still reaches us.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
      if (commitTimer) window.clearTimeout(commitTimer);
      surface.style.transition = "";
      surface.style.transform = "";
      surface.style.willChange = "";
    };
  }, [enabled]);

  return <div ref={surfaceRef}>{children}</div>;
}
