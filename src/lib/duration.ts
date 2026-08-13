import type { PlannedSet, Workout, WorkoutTemplate } from "./types";

/**
 * Return the estimated duration of one set, in minutes. Priority:
 *   1. Explicit `estimatedMinutes` field (new data).
 *   2. Cardio convention: for Running / Walking / Treadmill / Jog entries
 *      we historically encoded minutes in `targetReps` (e.g. 30 reps = 30 min).
 *   3. Strength / PT fallback: flat 2 min per set.
 */
export function setEstimatedMinutes(s: PlannedSet): number {
  if (typeof s.estimatedMinutes === "number") return s.estimatedMinutes;
  if (isCardioName(s.exerciseName)) return s.targetReps;
  return 2;
}

/** Total estimated workout duration in minutes (rounded). */
export function totalWorkoutMinutes(w: Workout): number {
  return Math.round(
    w.plannedSets.reduce((sum, s) => sum + setEstimatedMinutes(s), 0)
  );
}

/** Same as totalWorkoutMinutes, but for a template (which shares the same
 *  plannedSets shape). */
export function totalTemplateMinutes(t: WorkoutTemplate): number {
  return Math.round(
    t.plannedSets.reduce((sum, s) => sum + setEstimatedMinutes(s), 0)
  );
}

/**
 * Default estimated minutes for a brand-new set of an exercise.
 * Cardio entries default to 30 min (typical treadmill block), strength/PT
 * to 2 min per set.
 */
export function defaultEstimatedMinutes(exerciseName: string): number {
  if (isCardioName(exerciseName)) return 30;
  return 2;
}

function isCardioName(name: string): boolean {
  const n = name.toLowerCase();
  return /^(running|jog|walk|treadmill|bike|row|cycling)/.test(n);
}
