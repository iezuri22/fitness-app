import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ExerciseGif from "./ExerciseGif";
import { Button, ProgressBar } from "./ui";
import type { PlannedSet, Workout } from "../lib/types";

/**
 * Guided timed run through a workout's sets, in order.
 *
 * Built for mobility. Two clocks: one for the whole session, one for the hold
 * you're in, which auto-advances when it runs out. Deliberately unscored —
 * counting rounds on a stretch makes you rush the holds, which is the opposite
 * of the point.
 *
 * Sets without their own `workSeconds` fall back to DEFAULT_HOLD so a routine
 * that mixes timed holds with plain rep sets still runs end to end.
 */

const DEFAULT_HOLD = 30;

const secondsFor = (s: PlannedSet) => s.workSeconds ?? DEFAULT_HOLD;

export default function FlowRunner({
  workout,
  gifByExerciseId,
  onComplete,
  onFinish,
  onManage,
  onViewAsList,
}: {
  workout: Workout;
  gifByExerciseId: Map<string, string | undefined>;
  /** Mark one set done as the flow passes it. */
  onComplete: (set: PlannedSet) => void;
  onFinish: () => void;
  onManage: () => void;
  onViewAsList: () => void;
}) {
  const nav = useNavigate();

  const sets = useMemo(
    () => [...(workout.plannedSets ?? [])].sort((a, b) => a.order - b.order),
    [workout.plannedSets]
  );

  // Start at the first unlogged set so leaving and coming back resumes rather
  // than restarting a routine you're halfway through.
  const firstUndone = Math.max(0, sets.findIndex((s) => !s.completedAt));
  const [cursor, setCursor] = useState(firstUndone === -1 ? 0 : firstUndone);
  const [remaining, setRemaining] = useState(() =>
    sets.length ? secondsFor(sets[Math.max(0, firstUndone)]) : 0
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const current = sets[cursor];
  const next = sets[cursor + 1];

  // Total session length and how much of it is behind you. Derived from the
  // real set list rather than capMinutes, so pausing or skipping keeps the
  // headline clock honest.
  const totalSec = useMemo(() => sets.reduce((t, s) => t + secondsFor(s), 0), [sets]);
  const elapsedBefore = useMemo(
    () => sets.slice(0, cursor).reduce((t, s) => t + secondsFor(s), 0),
    [sets, cursor]
  );
  const sessionLeft = Math.max(
    0,
    totalSec - elapsedBefore - (secondsFor(current ?? sets[0]) - remaining)
  );

  const advance = useCallback(
    (markDone: boolean) => {
      const s = sets[cursor];
      if (s && markDone && !s.completedAt) onComplete(s);
      if (cursor + 1 >= sets.length) {
        setRunning(false);
        setDone(true);
        return;
      }
      setCursor((c) => c + 1);
      setRemaining(secondsFor(sets[cursor + 1]));
    },
    [cursor, sets, onComplete]
  );

  // One interval for the whole runner. `advance` is called from inside the
  // tick, so it has to be a ref-stable callback or the timer resets each turn.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        beep();
        advanceRef.current(true);
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, done]);

  const completedCount = sets.filter((s) => s.completedAt).length;

  if (!current && !done) {
    return (
      <div className="mx-auto max-w-xl p-6 text-[15px] text-[color:var(--color-muted)]">
        This routine has no sets yet.
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header
        className="flex items-center justify-between gap-3 px-4 pb-2.5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <button
          onClick={() => nav("/")}
          aria-label="Back to Today"
          className="-ml-1 flex shrink-0 items-center text-[color:var(--color-accent)] active:opacity-60"
        >
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 1.5 2 9 9 16.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[16px] font-semibold tracking-[-0.01em]">
            {workout.title}
          </div>
          <div className="text-[12px] tnum text-[color:var(--color-muted)]">
            {completedCount} of {sets.length} holds
          </div>
        </div>
        <div className="w-4 shrink-0" />
      </header>

      <div className="flex items-center justify-between px-4 pb-3 text-[14px] text-[color:var(--color-accent)]">
        <button onClick={onManage} className="active:opacity-60">
          Manage
        </button>
        <button onClick={onViewAsList} className="active:opacity-60">
          View as list
        </button>
      </div>

      <div className="space-y-4 px-4 pb-8">
        {/* Session clock */}
        <div className="rounded-[14px] bg-[color:var(--color-surface)] p-6 text-center">
          <div className="text-[13px] text-[color:var(--color-muted)]">
            {done ? "Finished" : running ? "Time left" : "Ready"}
          </div>
          <div className="mt-1 text-[56px] font-semibold leading-none tnum tracking-[-0.03em]">
            {fmt(done ? 0 : sessionLeft)}
          </div>
          <ProgressBar
            className="mt-5"
            tone={done ? "success" : "accent"}
            value={totalSec - sessionLeft}
            max={totalSec}
          />
        </div>

        {/* Current hold */}
        {!done && current && (
          <div className="rounded-[14px] bg-[color:var(--color-surface)] p-4">
            <div className="flex items-center gap-3">
              <ExerciseGif
                name={current.exerciseName}
                gifUrl={gifByExerciseId.get(current.exerciseId)}
                size="thumb"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-[color:var(--color-muted)]">Now</div>
                <div className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                  {current.exerciseName}
                </div>
              </div>
              <div className="shrink-0 text-[28px] font-semibold tnum tracking-[-0.02em]">
                {fmt(remaining)}
              </div>
            </div>
            {current.notes && (
              <p className="mt-3 text-[15px] leading-snug text-[color:var(--color-muted)]">
                {current.notes}
              </p>
            )}
            {next && (
              <div className="mt-3 border-t border-[color:var(--color-separator)] pt-3 text-[15px] text-[color:var(--color-muted)]">
                <span className="text-[color:var(--color-muted-2)]">Next</span>{" "}
                {next.exerciseName}
              </div>
            )}
          </div>
        )}

        {/* Transport */}
        {!done ? (
          <>
            <Button size="lg" block onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : completedCount > 0 ? "Resume" : "Start"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={cursor === 0}
                onClick={() => {
                  setCursor((c) => Math.max(0, c - 1));
                  setRemaining(secondsFor(sets[Math.max(0, cursor - 1)]));
                }}
              >
                Back
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => advance(true)}>
                Skip
              </Button>
            </div>
          </>
        ) : (
          <Button size="lg" block onClick={onFinish}>
            Finish
          </Button>
        )}

        {/* The rest of the flow, so you can see what's coming. */}
        <div className="overflow-hidden rounded-[14px] bg-[color:var(--color-surface)]">
          {sets.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setCursor(i);
                setRemaining(secondsFor(s));
              }}
              className={`flex w-full items-center gap-3 border-b border-[color:var(--color-separator)] px-4 py-2.5 text-left last:border-0 ${
                i === cursor && !done ? "bg-[color:var(--color-surface-2)]" : ""
              }`}
            >
              <span
                className={`w-6 shrink-0 text-[13px] tnum ${
                  i === cursor && !done
                    ? "text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-muted-2)]"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[16px] ${
                  s.completedAt ? "text-[color:var(--color-muted-2)]" : ""
                }`}
              >
                {s.exerciseName}
              </span>
              <span className="shrink-0 text-[13px] tnum text-[color:var(--color-muted)]">
                {secondsFor(s)}s
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.max(0, Math.round(total % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Short tone at each transition, so you can close your eyes and hold. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.45);
  } catch {
    /* audio is a nicety, never a failure */
  }
  navigator.vibrate?.(150);
}
