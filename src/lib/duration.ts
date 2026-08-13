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
  // A set with a clock on it takes exactly that long. Falling through to the
  // flat 2-minute guess made 30-second holds read as "~2m".
  if (typeof s.workSeconds === "number" && s.workSeconds > 0) return s.workSeconds / 60;
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
];

/**
 * Names that look time-based but aren't.
 *
 * Sleds are counted in trips, not minutes — real data has them at
 * `targetReps: 1`, which a duration conversion would read as "1 minute" or
 * worse. And "Walk Out" is a banded rotator-cuff drill; matching it on "walk"
 * turned a rehab exercise into a ten-minute cardio block.
 */
const NOT_TIME_BASED = [
  "sled",
  "walk out",
  "walkout",
  "wall walk",
  "farmer",
  "suitcase",
  "carry",
  "lunge",
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * True when this exercise should be logged as a duration instead of reps.
 * Used to pick the right set-row controls and to seed a sensible default
 * length when the exercise is added to a workout.
 */
export function isTimeBasedExercise(name: string): boolean {
  const n = ` ${norm(name)} `;
  if (NOT_TIME_BASED.some((p) => n.includes(p))) return false;
  if (TIME_BASED_PHRASES.some((p) => n.includes(` ${p} `))) return true;
  // Plain "Walk" / "Walking" is cardio, but only on its own — every compound
  // ("Walking Lunge", "Farmer's Walk") is a loaded movement and is excluded
  // above.
  const bare = norm(name);
  if (bare === "walk" || bare === "walking") return true;
  return false;
}

function isCardioName(name: string): boolean {
  return isTimeBasedExercise(name);
}
