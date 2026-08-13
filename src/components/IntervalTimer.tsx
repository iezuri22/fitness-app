import { useEffect, useRef, useState } from "react";
import type { PlannedSet } from "../lib/types";

/**
 * Impromptu set-by-set interval timer.
 *
 * Given the full ordered list of sets in the current workout and a per-set
 * duration, this component:
 *   1. Jumps to the first incomplete set.
 *   2. Counts down from `seconds` with a big ring.
 *   3. When the countdown hits 0, plays an alarm, calls `onSetComplete(set)`
 *      (parent marks it done + saves), then advances to the next incomplete
 *      set after a short rest (if `restSeconds` > 0).
 *   4. User can pause, skip forward, or cancel at any time.
 *
 * Designed for circuits or a "just start moving" mode when you don't want to
 * fiddle with reps/weight for every set.
 */
interface Props {
  sets: PlannedSet[];
  workSeconds: number;
  restSeconds: number;
  onSetComplete: (set: PlannedSet) => void | Promise<void>;
  onClose: () => void;
}

type Phase = "work" | "rest" | "done";

export default function IntervalTimer({
  sets,
  workSeconds,
  restSeconds,
  onSetComplete,
  onClose,
}: Props) {
  // Work with the list of remaining (not-yet-complete) sets, captured once at
  // mount. If the parent re-marks something complete, we keep our own cursor.
  const remainingRef = useRef<PlannedSet[]>(
    sets.filter((s) => !s.completedAt)
  );
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<Phase>(
    remainingRef.current.length > 0 ? "work" : "done"
  );
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(workSeconds);

  // Tick loop.
  useEffect(() => {
    if (paused || phase === "done") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 0.1) return 0;
        return r - 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [paused, phase]);

  // Phase transitions when the clock hits 0.
  useEffect(() => {
    if (remaining > 0 || phase === "done") return;
    beep();

    if (phase === "work") {
      // Mark the current set done, then either start rest or jump to next work.
      const current = remainingRef.current[cursor];
      if (current) void onSetComplete(current);

      const nextCursor = cursor + 1;
      if (nextCursor >= remainingRef.current.length) {
        setPhase("done");
        return;
      }
      if (restSeconds > 0) {
        setPhase("rest");
        setRemaining(restSeconds);
      } else {
        setCursor(nextCursor);
        setPhase("work");
        setRemaining(workSeconds);
      }
    } else if (phase === "rest") {
      setCursor((c) => c + 1);
      setPhase("work");
      setRemaining(workSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const currentSet = remainingRef.current[cursor];
  const total = phase === "rest" ? restSeconds : workSeconds;
  const progress = total > 0 ? Math.max(0, remaining) / total : 0;

  // Ring geometry.
  const SIZE = 240;
  const STROKE = 12;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dashoffset = CIRC * (1 - progress);

  const m = Math.floor(Math.max(0, remaining) / 60);
  const s = Math.floor(Math.max(0, remaining) % 60);

  function skip() {
    setRemaining(0);
  }

  function stepBack() {
    if (phase === "rest") {
      setPhase("work");
      setRemaining(workSeconds);
      return;
    }
    if (cursor > 0) {
      setCursor((c) => c - 1);
      setPhase("work");
      setRemaining(workSeconds);
    } else {
      setRemaining(workSeconds);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Dismiss interval timer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade"
      />

      <div
        className="animate-slide-up relative w-full max-w-xl rounded-t-[16px] bg-[color:var(--color-surface)] px-6 pb-8 pt-2"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[color:var(--color-muted-2)]" />

        <div className="flex items-center justify-between mb-5">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">
            {phase === "done"
              ? "All sets complete"
              : phase === "rest"
                ? "Rest"
                : `Set ${cursor + 1} of ${remainingRef.current.length}`}
          </div>
          <button
            onClick={onClose}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Close
          </button>
        </div>

        {phase !== "done" && currentSet && (
          <div className="text-center mb-3">
            <div
              className={`text-[17px] font-semibold tracking-[-0.01em] ${
                phase === "rest" ? "text-[color:var(--color-muted)]" : ""
              }`}
            >
              {phase === "rest"
                ? `Up next: ${remainingRef.current[cursor + 1]?.exerciseName ?? ""}`
                : currentSet.exerciseName}
            </div>
            {phase === "work" && (
              <div className="mt-0.5 text-[13px] text-[color:var(--color-muted)]">
                Target: {currentSet.targetReps} reps
                {currentSet.targetWeight ? ` @ ${currentSet.targetWeight}lb` : ""}
              </div>
            )}
          </div>
        )}

        <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={STROKE}
              fill="none"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={
                phase === "rest"
                  ? "var(--color-warn, #f5a623)"
                  : "var(--color-accent)"
              }
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashoffset}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-[52px] font-semibold tnum leading-none tracking-[-0.02em]">
                {m}:{String(s).padStart(2, "0")}
              </div>
              <div className="mt-1.5 text-[13px] text-[color:var(--color-muted)]">
                {phase === "done" ? "finished" : phase}
              </div>
            </div>
          </div>
        </div>

        {phase !== "done" ? (
          <div className="mt-7 flex items-center justify-center gap-3">
            <AdjustButton onClick={stepBack}>← Back</AdjustButton>
            <AdjustButton onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </AdjustButton>
            <AdjustButton onClick={skip}>Skip →</AdjustButton>
          </div>
        ) : (
          <div className="mt-7 flex items-center justify-center">
            <button
              onClick={onClose}
              className="rounded-xl bg-[color:var(--color-accent)] px-6 py-3 text-[16px] font-semibold text-white active:bg-[color:var(--color-accent-pressed)]"
            >
              Done
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes _it_fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes _it_slide { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-fade { animation: _it_fade 200ms ease-out forwards; }
        .animate-slide-up { animation: _it_slide 280ms cubic-bezier(0.32, 0.72, 0, 1) forwards; }
      `}</style>
    </div>
  );
}

function AdjustButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-[color:var(--color-surface-2)] px-5 py-2.5 text-[15px] font-medium text-white transition-colors active:bg-[color:var(--color-surface-3)]"
    >
      {children}
    </button>
  );
}

function beep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    // Two quick chirps so it reads as an "alarm" not just a beep.
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = i === 0 ? 880 : 1175;
      o.type = "sine";
      const start = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      o.start(start);
      o.stop(start + 0.22);
    }
    if ("vibrate" in navigator) navigator.vibrate?.([200, 80, 200]);
  } catch {
    /* noop */
  }
}
