import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Swipe a row left to reveal Delete.
 *
 * Chosen over a visible trash button on every row because the set list is the
 * densest thing in the app and already reads as busy — this adds a way to
 * delete without adding anything to look at. Same reason iOS does it.
 *
 * Deliberately reveals a button rather than deleting on release: a set you
 * swipe away by accident mid-workout is logged work you can't get back, so
 * the destructive step stays an explicit tap.
 */

/** Width of the revealed action. */
const ACTION_PX = 76;
/** Travel before we decide this is a horizontal swipe and not a scroll. */
const AXIS_PX = 8;
/** How far you have to get for the row to stay open on release. */
const OPEN_AT = ACTION_PX * 0.5;

export default function SwipeToDelete({
  children,
  onDelete,
  label = "Delete",
  disabled = false,
}: {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || disabled) return;

    let phase: "idle" | "deciding" | "dragging" = "idle";
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let base = 0;

    const paint = (x: number, animate: boolean) => {
      surface.style.transition = animate ? "transform 180ms cubic-bezier(0.32,0.72,0,1)" : "";
      surface.style.transform = x ? `translate3d(${x}px,0,0)` : "";
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      phase = "deciding";
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      base = open ? -ACTION_PX : 0;
      dx = base;
    };

    const onMove = (e: TouchEvent) => {
      if (phase === "idle") return;
      const t = e.touches[0];
      const moveX = t.clientX - startX;
      const moveY = t.clientY - startY;
      if (phase === "deciding") {
        if (Math.abs(moveX) < AXIS_PX && Math.abs(moveY) < AXIS_PX) return;
        // Vertical means the list is scrolling. Let it.
        if (Math.abs(moveY) > Math.abs(moveX)) {
          phase = "idle";
          return;
        }
        phase = "dragging";
      }
      // Left only, and never further than the button is wide.
      dx = Math.min(0, Math.max(-ACTION_PX, base + moveX));
      if (e.cancelable) e.preventDefault();
      paint(dx, false);
    };

    const onEnd = () => {
      if (phase !== "dragging") {
        phase = "idle";
        return;
      }
      const shouldOpen = dx < -OPEN_AT;
      paint(shouldOpen ? -ACTION_PX : 0, true);
      setOpen(shouldOpen);
      phase = "idle";
    };

    surface.addEventListener("touchstart", onStart, { passive: true });
    surface.addEventListener("touchmove", onMove, { passive: false });
    surface.addEventListener("touchend", onEnd, { passive: true });
    surface.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      surface.removeEventListener("touchstart", onStart);
      surface.removeEventListener("touchmove", onMove);
      surface.removeEventListener("touchend", onEnd);
      surface.removeEventListener("touchcancel", onEnd);
    };
  }, [open, disabled]);

  // Keep the transform in step when `open` changes from a tap rather than a drag.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.style.transition = "transform 180ms cubic-bezier(0.32,0.72,0,1)";
    surface.style.transform = open ? `translate3d(${-ACTION_PX}px,0,0)` : "";
  }, [open]);

  if (disabled) return <>{children}</>;

  return (
    <div className="relative overflow-hidden">
      {/* Sits behind the row and is uncovered by the swipe. */}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onDelete();
        }}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 grid place-items-center bg-[color:var(--color-danger)] text-[13px] font-semibold text-white"
        style={{ width: ACTION_PX }}
      >
        {label}
      </button>
      <div ref={surfaceRef} className="relative bg-[color:var(--color-bg)]">
        {children}
      </div>
    </div>
  );
}
