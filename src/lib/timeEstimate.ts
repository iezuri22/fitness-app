import type { PlannedSet, Workout, WorkoutTemplate } from "./types";

/**
 * Workout duration estimation.
 *
 * Precedence, highest first:
 *   1. `capMinutes` on an AMRAP or flow — those run to a clock, so the clock
 *      IS the duration.
 *   2. `estimatedMinutes` on the template — an explicit duration set by the
 *      author or by the user in Library → Name & duration. Overrides the
 *      model, which is the point: the model is a guess and the person who
 *      wrote the routine knows how long it actually takes.
 *   3. The per-set model below.
 *
 * Per-set breakdown:
 *   - If `estimatedMinutes` is set:
 *       - Treat as cardio when >= 5 min (it already folds in its own pacing)
 *       - Otherwise use as working time and still add `restSeconds` after
 *   - Else if `workSeconds` is set: workSeconds/60 + rest
 *   - Else (rep-counted set): assume ~33s of working time + rest
 *
 * Then for the whole template / workout:
 *   - Sum set times
 *   - Subtract the trailing rest after the last (non-cardio) set
 *   - Add a small ~1.5 min buffer for warmup + transitions
 */

const CARDIO_THRESHOLD_MIN = 5;
const DEFAULT_WORK_MIN_PER_SET = 0.55; // ~33 seconds
const DEFAULT_REST_SEC = 45;
const BUFFER_MIN = 1.5;

function isCardioSet(s: PlannedSet): boolean {
  return (s.estimatedMinutes ?? 0) >= CARDIO_THRESHOLD_MIN;
}

/** Total minutes this set contributes, including its own rest interval. */
export function setMinutes(s: PlannedSet): number {
  const cardio = isCardioSet(s);
  const workMin =
    s.estimatedMinutes != null
      ? s.estimatedMinutes
      : s.workSeconds != null
      ? s.workSeconds / 60
      : DEFAULT_WORK_MIN_PER_SET;
  const restMin = cardio ? 0 : (s.restSeconds ?? DEFAULT_REST_SEC) / 60;
  return workMin + restMin;
}

/** Estimated minutes for a full template or workout's plannedSets. */
export function estimatePlannedMinutes(
  subject: Pick<WorkoutTemplate | Workout, "plannedSets"> &
    Partial<Pick<WorkoutTemplate | Workout, "format" | "capMinutes">> &
    Partial<Pick<WorkoutTemplate, "estimatedMinutes">>
): number {
  // Formats that run to a clock report that clock. An AMRAP's `plannedSets` is
  // ONE round, so summing it would call a 20-minute benchmark a 4-minute
  // workout; a flow's holds sum to its cap already, but the generic estimate
  // would add a warm-up buffer a stretch routine doesn't have.
  if ((subject.format === "amrap" || subject.format === "flow") && subject.capMinutes) {
    return subject.capMinutes;
  }

  // An explicit duration beats the model. Every starter template whose name
  // carries a number ("Home · Kettlebell 25") sets this, so the number on the
  // card can never drift away from the number in the name.
  if (subject.estimatedMinutes != null && subject.estimatedMinutes > 0) {
    return subject.estimatedMinutes;
  }

  const sets = subject.plannedSets ?? [];
  if (sets.length === 0) return 0;
  let total = 0;
  for (const s of sets) total += setMinutes(s);
  // No rest after the very last set.
  const last = sets[sets.length - 1];
  if (!isCardioSet(last)) {
    total -= (last.restSeconds ?? DEFAULT_REST_SEC) / 60;
  }
  return total + BUFFER_MIN;
}

/** Minutes earned for sets that are already marked complete in a workout. */
export function workoutMinutesDone(w: Workout): number {
  let total = 0;
  for (const s of w.plannedSets ?? []) {
    if (s.completedAt) total += setMinutes(s);
  }
  return total;
}

/** "42 min" / "1h 5m" — compact display string. Minutes are rounded. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
