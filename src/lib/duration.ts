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

/**
 * Machines and modalities measured in time rather than reps.
 *
 * Matched anywhere in the name, not just at the start — the old anchored
 * version missed every machine whose name didn't lead with the modality
 * ("Assault Bike", "Stair Climber (StairMaster)", "Rowing Machine (Erg)").
 *
 * The phrases are deliberately specific. A bare "row" would swallow every
 * Seated Cable Row in the library and turn a back exercise into a cardio
 * block, so rowing only matches as "rowing machine" / "row erg".
 */
const TIME_BASED_PHRASES = [
  "treadmill",
  "rowing machine",
  "row erg",
  "ski erg",
  "ergometer",
  "stair climber",
  "stairmaster",
  "stair mill",
  "elliptical",
  "assault bike",
  "air bike",
  "stationary bike",
  "exercise bike",
  "spin bike",
  "jump rope",
  "jacobs ladder",
  "running",
  "jog",
  "cycling",
  "sled push",
  "sled drag",
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * True when this exercise should be logged as a duration instead of reps.
 * Used to pick the right set-row controls and to seed a sensible default
 * length when the exercise is added to a workout.
 */
export function isTimeBasedExercise(name: string): boolean {
  const n = ` ${norm(name)} `;
  if (TIME_BASED_PHRASES.some((p) => n.includes(` ${p} `))) return true;
  // "Walk" on its own is cardio; "Farmer Walk" and "Walking Lunge" are not.
  if (/\b(walk|walking)\b/.test(n) && !/farmer|lunge|suitcase|carry/.test(n)) return true;
  return false;
}

function isCardioName(name: string): boolean {
  return isTimeBasedExercise(name);
}
