import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui";
import ExerciseGif from "./ExerciseGif";
import type { AmrapResult } from "../lib/db";
import type { Workout } from "../lib/types";

/**
 * AMRAP execution screen — as many rounds as possible inside a time cap.
 *
 * Different enough from set-by-set logging to warrant its own screen: there's
 * one clock, one round list, and one number that matters. Tapping the big
 * button banks a round; on finish we save `roundsCompleted` so the score can
 * be compared against previous attempts.
 *
 * The timer is derived from a start timestamp rather than counted down by
 * interval, so it stays accurate if the tab is backgrounded mid-workout.
 */
export default function AmrapRunner({
  workout,
  history,
  gifByExerciseId,
  onFinish,
  onManage,
  onViewAsList,
  onBack,
}: {
  workout: Workout;
  history: AmrapResult[];
  gifByExerciseId: Map<string, string | undefined>;
  onFinish: (rounds: number, extraReps: number) => Promise<void>;
  /** Open the plan editor — reps, order, supersets, timers. */
  onManage: () => void;
  /** Drop to the plain set table. */
  onViewAsList: () => void;
  /** Invoked by the back chevron. Pops history where there is any. */
  onBack: () => void;
}) {
  const capSec = (workout.capMinutes ?? 20) * 60;

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [rounds, setRounds] = useState(workout.roundsCompleted ?? 0);
  const [extraReps, setExtraReps] = useState(workout.extraReps ?? 0);
  const [finishing, setFinishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const beeped = useRef(false);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const remaining = Math.max(0, capSec - elapsed);
  const expired = startedAt !== null && remaining === 0;
  const pct = capSec > 0 ? (remaining / capSec) * 100 : 0;

  // Audible cue at the buzzer — once.
  useEffect(() => {
    if (!expired || beeped.current) return;
    beeped.current = true;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch {
      // Audio is a nicety — never let it break the workout.
    }
  }, [expired]);

  const best = useMemo(
    () => history.reduce((m, h) => Math.max(m, h.rounds), 0),
    [history]
  );
  const last = history[0];

  // One round = one set of each movement.
  const roundSets = [...workout.plannedSets].sort((a, b) => a.order - b.order);
  const totalReps = roundSets.reduce((n, s) => n + (s.targetReps ?? 0), 0);

  async function save() {
    setSaving(true);
    try {
      await onFinish(rounds, extraReps);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full max-w-xl mx-auto flex flex-col">
      <header
        className="flex items-center justify-between gap-3 px-5 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
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
          <div className="text-[12px] text-[color:var(--color-muted)]">
            {workout.capMinutes ?? 20} min · as many rounds as possible
          </div>
        </div>
        <div className="size-9 shrink-0" />
      </header>

      <div className="flex items-center justify-between px-5 pb-3 text-[14px] text-[color:var(--color-accent)]">
        <button onClick={onManage} className="active:opacity-60">
          Manage
        </button>
        <button onClick={onViewAsList} className="active:opacity-60">
          View as list
        </button>
      </div>

      <div className="px-5 pb-32 space-y-5">
        {/* Clock */}
        <div className="rounded-[14px] bg-[color:var(--color-surface)] p-6 text-center">
          <div
            className={`text-[13px] ${
              expired
                ? "text-[color:var(--color-warn)]"
                : "text-[color:var(--color-muted)]"
            }`}
          >
            {startedAt === null ? "Ready" : expired ? "Time" : "Remaining"}
          </div>
          <div className="mt-1 text-[64px] font-semibold leading-none tnum tracking-[-0.03em]">
            {fmt(startedAt === null ? capSec : remaining)}
          </div>
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-[color:var(--color-surface-3)]">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                expired
                  ? "bg-[color:var(--color-warn)]"
                  : "bg-[color:var(--color-accent)]"
              }`}
              style={{ width: `${startedAt === null ? 100 : pct}%` }}
            />
          </div>
        </div>

        {startedAt === null && (
          <div className="rounded-[14px] bg-[color:var(--color-surface)] p-4">
            <div className="text-[16px] tracking-[-0.01em]">How this works</div>
            <p className="mt-1.5 text-[15px] leading-snug text-[color:var(--color-muted)]">
              Work through the round below, then start it again. Keep going until
              the {workout.capMinutes ?? 20}-minute clock runs out and tap
              <span className="text-white"> +1 round</span> each time you finish
              one. Your score is rounds completed — the same round every time, so
              you can compare it against your past attempts.
            </p>
          </div>
        )}

        {/* Score */}
        <div className="rounded-[14px] bg-[color:var(--color-surface)] p-5 text-center">
          <div className="text-[13px] text-[color:var(--color-muted)]">Rounds completed</div>
          <div className="mt-1 text-[72px] font-semibold leading-none tnum tracking-[-0.03em]">
            {rounds}
          </div>
          {extraReps > 0 && (
            <div className="mt-1 text-[15px] tnum text-[color:var(--color-muted)]">
              + {extraReps} reps
            </div>
          )}

          <button
            type="button"
            onClick={() => setRounds((r) => r + 1)}
            disabled={startedAt === null}
            className="mt-5 w-full rounded-xl bg-[color:var(--color-accent)] py-5 text-[20px] font-semibold tracking-[-0.01em] text-white transition-colors active:bg-[color:var(--color-accent-pressed)] disabled:opacity-30"
          >
            +1 round
          </button>

          <div className="flex items-center justify-center gap-2 mt-3">
            <SmallBtn onClick={() => setRounds((r) => Math.max(0, r - 1))} label="− round" />
            <SmallBtn onClick={() => setExtraReps((r) => r + 5)} label="+5 reps" />
            <SmallBtn onClick={() => setExtraReps(0)} label="clear reps" />
          </div>

          {(best > 0 || last) && (
            <div className="mt-4 flex items-center justify-center gap-4 border-t border-[color:var(--color-separator)] pt-4 text-[13px] tnum">
              {best > 0 && (
                <span className="text-[color:var(--color-muted)]">
                  Best <b className="text-[color:var(--color-success)]">{best}</b>
                </span>
              )}
              {last && (
                <span className="text-[color:var(--color-muted)]">
                  Last <b className="text-white">{last.rounds}</b>
                </span>
              )}
              {rounds > best && best > 0 && (
                <span className="font-medium text-[color:var(--color-success)]">PR pace</span>
              )}
            </div>
          )}
        </div>

        {/* The round */}
        <div className="overflow-hidden rounded-[14px] bg-[color:var(--color-surface)]">
          <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">One round</div>
            <div className="text-[13px] tnum text-[color:var(--color-muted)]">
              {totalReps} reps
            </div>
          </div>
          <div className="pb-2">
            {roundSets.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                <ExerciseGif
                  name={s.exerciseName}
                  gifUrl={gifByExerciseId.get(s.exerciseId)}
                  size="mini"
                />
                <div className="min-w-0 flex-1 truncate text-[16px]">{s.exerciseName}</div>
                <div className="shrink-0 text-[16px] tnum text-[color:var(--color-muted)]">
                  {s.targetReps}
                </div>
              </div>
            ))}
          </div>
        </div>

        {workout.notes && (
          <p className="px-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
            {workout.notes}
          </p>
        )}

        {history.length > 0 && (
          <div className="rounded-[14px] bg-[color:var(--color-surface)] p-4">
            <div className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">
              Your history
            </div>
            <ScoreChart history={history} />
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-[color:var(--color-separator)] bg-[color:var(--color-bg)]/85 px-4 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="max-w-xl mx-auto">
          {startedAt === null ? (
            <Button size="lg" block onClick={() => { setStartedAt(Date.now()); setNow(Date.now()); }}>
              Start {workout.capMinutes ?? 20}-minute AMRAP
            </Button>
          ) : !finishing ? (
            <Button
              size="lg"
              variant={expired ? "primary" : "secondary"}
              className="w-full"
              onClick={() => setFinishing(true)}
            >
              {expired ? `Log ${rounds} rounds` : "Finish early"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setFinishing(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? "Saving…" : `Save ${rounds} rounds`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bar chart of past scores — the whole point is seeing the trend. */
function ScoreChart({ history }: { history: AmrapResult[] }) {
  const rows = [...history].reverse().slice(-8); // oldest → newest
  const max = Math.max(...rows.map((r) => r.rounds), 1);
  return (
    <div className="flex items-end justify-between gap-1.5 h-24">
      {rows.map((r) => {
        const isBest = r.rounds === Math.max(...rows.map((x) => x.rounds));
        return (
          <div key={r.workoutId} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="text-[10px] font-bold tabular-nums">{r.rounds}</div>
            <div
              className={`w-full rounded-t-md ${
                isBest ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-accent)]"
              }`}
              style={{ height: `${Math.max(6, (r.rounds / max) * 60)}px` }}
            />
            <div className="text-[9px] text-[color:var(--color-muted-2)] tabular-nums truncate w-full text-center">
              {r.date.slice(5).replace("-", "/")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmallBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-[color:var(--color-surface-2)] px-3.5 py-1.5 text-[13px] font-medium text-[color:var(--color-muted)] transition-colors active:bg-[color:var(--color-surface-3)]"
    >
      {label}
    </button>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
