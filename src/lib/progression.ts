/**
 * Progressive overload — turn what you actually lifted last time into what the
 * plan should say today.
 *
 * The rule is double progression, which is the standard for a reason: you earn
 * the weight increase by first earning the reps. Concretely, for each exercise:
 *
 *   · Hit the top of the rep range on every set  → add weight, reset to the
 *     bottom of the range.
 *   · Hit the target reps on every set           → add one rep.
 *   · Missed on any set                          → repeat it unchanged.
 *
 * Deliberately conservative in two ways. It only ever looks at the most recent
 * *completed* session for that exercise, so one good day doesn't compound off a
 * stale PR. And it never suggests a jump bigger than one increment — the point
 * is a number you'll actually hit, not the biggest one that's arguable.
 *
 * Nothing here writes anything. It proposes; the review screen is where the
 * user confirms, and that's on purpose — silently changing the weight under
 * someone mid-programme is how you get injured or discouraged.
 */
import type { PlannedSet, Workout } from "./types";

/** Reps above the plan's target that still count as "in range". */
const REP_HEADROOM = 3;

export interface TargetSuggestion {
  exerciseId: string;
  exerciseName: string;
  /** How many sets of this exercise are in today's plan. */
  setCount: number;
  /** What the plan currently says. */
  currentWeight?: number;
  currentReps: number;
  /** What it should say today. */
  suggestedWeight?: number;
  suggestedReps: number;
  /** Plain-language justification, shown under the exercise name. */
  reason: string;
  /** False when the suggestion matches the plan — nothing to confirm. */
  changed: boolean;
}

/**
 * Smallest increment worth adding. Dumbbells and light accessory work move in
 * smaller steps than a loaded barbell, and suggesting +5lb on a 10lb lateral
 * raise is a 50% jump nobody makes.
 */
function increment(weight: number): number {
  if (weight < 15) return 2.5;
  if (weight < 40) return 5;
  return 5;
}

/** Sets of one exercise from a workout, in order. */
function setsFor(w: Workout, exerciseId: string): PlannedSet[] {
  return (w.plannedSets ?? [])
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => a.order - b.order);
}

/**
 * The most recent completed session that logged this exercise, excluding the
 * workout being planned.
 */
function lastCompleted(
  recent: Workout[],
  exerciseId: string,
  excludeId: string
): Workout | undefined {
  return [...recent]
    .filter((w) => w.id !== excludeId && w.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((w) => setsFor(w, exerciseId).some((s) => s.completedAt));
}

export function suggestTargets(
  workout: Workout,
  recent: Workout[]
): TargetSuggestion[] {
  // One entry per exercise, in the order it appears in today's plan.
  const seen = new Set<string>();
  const out: TargetSuggestion[] = [];

  for (const s of [...(workout.plannedSets ?? [])].sort((a, b) => a.order - b.order)) {
    if (seen.has(s.exerciseId)) continue;
    seen.add(s.exerciseId);

    // Timed work progresses on duration, not load — leave it alone.
    if (s.workSeconds != null) continue;

    const planSets = setsFor(workout, s.exerciseId);
    const currentWeight = s.targetWeight;
    const currentReps = s.targetReps;

    const prev = lastCompleted(recent, s.exerciseId, workout.id);
    if (!prev) {
      out.push({
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        setCount: planSets.length,
        currentWeight,
        currentReps,
        suggestedWeight: currentWeight,
        suggestedReps: currentReps,
        reason: "First time — start here and we'll build from it",
        changed: false,
      });
      continue;
    }

    const done = setsFor(prev, s.exerciseId).filter((x) => x.completedAt);
    const lastWeight = done[0]?.actualWeight ?? done[0]?.targetWeight;
    const lastRepsEach = done.map((x) => x.actualReps ?? x.targetReps ?? 0);
    const lastTarget = done[0]?.targetReps ?? currentReps;
    const minReps = Math.min(...lastRepsEach);
    const when = prettyWhen(prev.date);

    let suggestedWeight = lastWeight ?? currentWeight;
    let suggestedReps = lastTarget;
    let reason: string;

    if (minReps >= lastTarget + REP_HEADROOM) {
      // Topped out the range on every set — take the weight up, reps back down.
      if (suggestedWeight != null && suggestedWeight > 0) {
        suggestedWeight = suggestedWeight + increment(suggestedWeight);
        suggestedReps = lastTarget;
        reason = `${when} you hit ${minReps} on every set — time to add weight`;
      } else {
        // Bodyweight: there's no load to add, so keep climbing reps.
        suggestedReps = minReps + 1;
        reason = `${when} you hit ${minReps} on every set — add a rep`;
      }
    } else if (minReps >= lastTarget) {
      suggestedReps = lastTarget + 1;
      reason = `${when} you hit all ${lastTarget} — add a rep`;
    } else {
      suggestedReps = lastTarget;
      reason = `${when} you got ${minReps} of ${lastTarget} — repeat it`;
    }

    out.push({
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      setCount: planSets.length,
      currentWeight,
      currentReps,
      suggestedWeight,
      suggestedReps,
      reason,
      changed:
        suggestedReps !== currentReps ||
        (suggestedWeight ?? null) !== (currentWeight ?? null),
    });
  }

  return out;
}

/** Apply confirmed suggestions to a workout's set list. */
export function applyTargets(
  sets: PlannedSet[],
  suggestions: TargetSuggestion[]
): PlannedSet[] {
  const byExercise = new Map(suggestions.map((s) => [s.exerciseId, s]));
  return sets.map((s) => {
    const sug = byExercise.get(s.exerciseId);
    if (!sug || s.workSeconds != null) return s;
    return {
      ...s,
      targetReps: sug.suggestedReps,
      targetWeight: sug.suggestedWeight,
    };
  });
}

/** "Monday" for the last week, otherwise a date. */
function prettyWhen(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const days = Math.round((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
