import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useBack } from "../hooks/useBack";
import { useAuth } from "../hooks/useAuth";
import { getWorkout, listWorkouts, saveWorkout } from "../lib/db";
import {
  Button,
  Card,
  Group,
  PageHeader,
  PageSkeleton,
} from "../components/ui";
import {
  applyTargets,
  suggestTargets,
  type TargetSuggestion,
} from "../lib/progression";
import type { Workout } from "../lib/types";

/**
 * "Are these weights right?" — the confirmation step before a workout starts.
 *
 * Shown only when there's something to say: if nothing has changed since last
 * time, this redirects straight into the runner rather than making you tap
 * through a screen that tells you nothing.
 *
 * Every number is editable here. The suggestion is a starting point from what
 * you actually lifted, not an instruction — the whole reason this screen exists
 * instead of silently rewriting the plan.
 */
export default function ReviewTargets() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<TargetSuggestion[]>([]);
  const [starting, setStarting] = useState(false);

  const backTo = searchParams.get("from") || "/";
  const back = useBack();
  const runnerHref = `/workout/${workoutId}?from=${encodeURIComponent(backTo)}`;

  useEffect(() => {
    if (!user || !workoutId) return;
    let alive = true;
    (async () => {
      const [w, recent] = await Promise.all([
        getWorkout(user.uid, workoutId),
        listWorkouts(user.uid, { limit: 60 }),
      ]);
      if (!alive) return;
      setWorkout(w);
      if (!w) return;

      // Benchmarks and guided flows are fixed by definition. An AMRAP's round
      // is the thing being scored — progressing its reps would silently
      // invalidate every past attempt — and a mobility flow progresses on
      // duration, not load. Straight to the runner.
      if (w.format === "amrap" || w.format === "flow") {
        nav(runnerHref, { replace: true });
        return;
      }

      const sug = suggestTargets(w, recent);
      // Nothing to confirm — don't make them tap through an empty screen.
      if (!sug.some((s) => s.changed)) {
        nav(runnerHref, { replace: true });
        return;
      }
      setSuggestions(sug);
    })();
    return () => {
      alive = false;
    };
  }, [user, workoutId, nav, runnerHref]);

  const changedCount = useMemo(
    () => suggestions.filter((s) => s.changed).length,
    [suggestions]
  );

  function edit(exerciseId: string, patch: Partial<TargetSuggestion>) {
    setSuggestions((prev) =>
      prev.map((s) => (s.exerciseId === exerciseId ? { ...s, ...patch } : s))
    );
  }

  async function startWith(applySuggestions: boolean) {
    if (!user || !workout || starting) return;
    setStarting(true);
    try {
      const patch: Partial<Workout> = {
        status: "in_progress",
        startedAt: workout.startedAt ?? Date.now(),
      };
      if (applySuggestions) {
        patch.plannedSets = applyTargets(workout.plannedSets, suggestions);
      }
      await saveWorkout(user.uid, workout.id, patch);
      nav(runnerHref, { replace: true });
    } catch (e) {
      console.error("[ReviewTargets] start failed:", e);
      setStarting(false);
    }
  }

  if (workout === undefined || (workout && suggestions.length === 0)) {
    return <PageSkeleton rows={4} />;
  }
  if (workout === null) {
    return (
      <div className="py-10 text-center text-[color:var(--color-muted)]">Not found.</div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Today's targets"
        subtitle={`${changedCount} change${changedCount === 1 ? "" : "s"} from last time`}
        action={
          <button
            onClick={() => back(backTo)}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Cancel
          </button>
        }
      />

      <Card>
        <p className="text-[15px] leading-snug text-[color:var(--color-muted)]">
          Based on what you actually lifted. Adjust anything that looks wrong —
          what you start with is what gets logged, and what the next session
          builds on.
        </p>
      </Card>

      {/* Stacked rather than a Row: the reason is the justification for
          changing your working weight, so it must not truncate. */}
      <Group>
        {suggestions.map((s) => (
          <div key={s.exerciseId} className="px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-tight tracking-[-0.01em]">
                  {s.exerciseName}
                </div>
                <div className="mt-0.5 text-[13px] leading-snug text-[color:var(--color-muted)]">
                  {s.reason}
                </div>
              </div>
              <span className="shrink-0 text-[13px] tnum text-[color:var(--color-muted-2)]">
                {s.setCount} {s.setCount === 1 ? "set" : "sets"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              {s.suggestedWeight != null && s.suggestedWeight > 0 && (
                <>
                  <NumberField
                    ariaLabel={`${s.exerciseName} weight`}
                    value={s.suggestedWeight}
                    step={2.5}
                    onChange={(v) => edit(s.exerciseId, { suggestedWeight: v, changed: true })}
                  />
                  <span className="text-[13px] text-[color:var(--color-muted-2)]">lb</span>
                </>
              )}
              <span className="text-[13px] text-[color:var(--color-muted-2)]">×</span>
              <NumberField
                ariaLabel={`${s.exerciseName} reps`}
                value={s.suggestedReps}
                step={1}
                onChange={(v) => edit(s.exerciseId, { suggestedReps: v, changed: true })}
              />
              <span className="text-[13px] text-[color:var(--color-muted-2)]">reps</span>
            </div>
          </div>
        ))}
      </Group>

      <Button size="lg" block disabled={starting} onClick={() => void startWith(true)}>
        {starting ? "Starting…" : "Use these and start"}
      </Button>
      <Button
        variant="secondary"
        block
        disabled={starting}
        onClick={() => void startWith(false)}
      >
        Keep the original plan
      </Button>
    </div>
  );
}

/** Compact inline number input sized for a trailing slot. */
function NumberField({
  value,
  onChange,
  step,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      step={step}
      min={0}
      value={value || ""}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      onFocus={(e) => e.currentTarget.select()}
      className="h-8 w-14 rounded-[8px] bg-[color:var(--color-surface-2)] text-center text-[15px] font-medium tnum outline-none focus:bg-[color:var(--color-surface-3)]"
    />
  );
}
