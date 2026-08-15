/** Data model — mirrors Firestore collections under /users/{uid}/... */

export type SetType = "Working" | "Warm-up" | "PT/Rehab" | "Stretch" | "Drop";

export type ExerciseCategory =
  | "PT/Rehab"
  | "Upper Body"
  | "Lower Body"
  | "Core"
  | "Full Body"
  | "Cardio"
  | "Mobility";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string[]; // e.g. ["Bands", "Kettlebell 20lb"]
  muscleGroups: string[]; // e.g. ["Rotator Cuff", "Scapular Stabilizers"]
  isPT: boolean;
  isBannedLatarjet: boolean;
  defaultReps?: number;
  defaultWeight?: number;
  notes?: string;
  videoUrl?: string;
  /** Path to a looping GIF demo — either a /gifs/<slug>.gif bundled asset or an external URL. */
  gifUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type WorkoutStatus = "planned" | "in_progress" | "completed" | "skipped";

/**
 * How a workout is executed. This picks the runner UI, not the data shape —
 * every format still stores its work in `plannedSets`, so any workout can be
 * viewed as a plain set list regardless of format.
 *
 *   - "standard" — work through the set list, logging each set (the default).
 *   - "amrap"    — as many rounds as possible inside a time cap. `plannedSets`
 *                  describes ONE round; the score is `roundsCompleted`, which
 *                  is what gets tracked over time.
 *   - "flow"     — a guided, timed run through the sets in order: one clock for
 *                  the session, one for the current hold, auto-advancing. Used
 *                  for mobility, where the point is holding for the duration.
 *                  Deliberately unscored — counting rounds on a stretch makes
 *                  you rush the holds, which defeats the exercise.
 */
export type WorkoutFormat = "standard" | "amrap" | "flow";

export interface PlannedSet {
  id: string;
  exerciseId: string;
  exerciseName: string; // denormalized for quick rendering
  order: number;
  /**
   * Optional superset grouping. All sets that share the same string value are
   * performed interleaved (A1 → B1 → A2 → B2 → ...) and render inside one
   * SUPERSET card on the workout page. Omit for normal sequential sets.
   */
  supersetGroupId?: string;
  targetReps: number;
  targetWeight?: number; // lbs; omit for bodyweight
  setType: SetType;
  restSeconds?: number;
  /**
   * Optional per-set work duration in seconds. When set, the set row shows a
   * ▶ button that runs a work→rest→done countdown and auto-marks the set
   * complete when finished. Also acts as the filter for the "Play all timers"
   * header action — only sets with a workSeconds value are included in that
   * sequential run. Leave undefined for normal rep-counted sets.
   */
  workSeconds?: number;
  notes?: string;
  /**
   * Estimated time this set takes, in minutes. Used by the Today page's duration
   * stat and per-set display. For cardio sets this is the full duration (e.g. a
   * 30-min treadmill run). For strength sets it's just working time; rest is
   * counted separately via `restSeconds`.
   */
  estimatedMinutes?: number;
  // Logged values (filled during execution)
  actualReps?: number;
  actualWeight?: number;
  completedAt?: number | null;
  userNotes?: string;
}

export interface Workout {
  id: string;
  date: string; // "YYYY-MM-DD"
  /**
   * Optional slot tag so two workouts can share a date. Set by the weekly
   * planner when it splits a day into a morning PT session + a later strength
   * session. `undefined` for legacy/single-per-day entries.
   */
  slot?: "morning-pt" | "strength";
  title: string;
  focus: string; // "Upper Body + Shoulder Rehab", etc.
  status: WorkoutStatus;
  plannedSets: PlannedSet[];
  notes?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  /**
   * Category carried over from the template this workout was started from
   * (if any). Used by the Today page to count progress against WEEKLY_GOALS.
   */
  category?: TemplateCategory;
  /** If this workout was started from a template, the template's doc id. */
  fromTemplateId?: string;
  /** Execution style. Absent means "standard" (legacy docs). */
  format?: WorkoutFormat;
  /** AMRAP and flow — the session length in minutes. */
  capMinutes?: number;
  /**
   * Explicit duration in minutes, copied from the template this was started
   * from. Without it a workout falls back to the per-set estimate, so
   * "Home · Full Body 30" would read 30 min in Routines and 24 min on Today
   * — the same routine, two answers. See WorkoutTemplate.estimatedMinutes.
   */
  estimatedMinutes?: number;
  /** AMRAP only — full rounds finished. This is the score we track over time. */
  roundsCompleted?: number;
  /** AMRAP only — reps into the next, unfinished round. */
  extraReps?: number;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

/**
 * A "category" classifies a workout template for goal tracking. Every day the
 * user picks ONE template to execute; their weekly progress is counted per
 * category against WEEKLY_GOALS.
 *
 *   - "PT Only"  → short recovery day (just rehab exercises, ~15-25 min)
 *   - "Full"     → PT block + strength work (~45-75 min)
 */
export type TemplateCategory = "PT Only" | "Full";

/**
 * A reusable workout definition. Templates live in the library and can be
 * flagged as "in this week's pool" via `poolWeek` (an ISO week string like
 * "2026-W17"). When the user picks a template on a given day, the app clones
 * its `plannedSets` into a new Workout doc dated today.
 *
 * The `plannedSets` here use stable IDs within the template — they get
 * re-minted when a workout is started so execution edits don't mutate the
 * template itself.
 */
export interface WorkoutTemplate {
  id: string;
  name: string;               // "Upper Push + PT"
  focus: string;              // "Upper Body + Shoulder Rehab"
  category: TemplateCategory;
  plannedSets: PlannedSet[];
  /**
   * Explicit duration in minutes. Overrides the per-set estimate everywhere
   * the template's length is shown. Set it when the name makes a promise
   * ("Gym · Express Upper 25") — the estimator models working time plus rest
   * and reliably runs low on strength work, where setup, plate changes and
   * walking between machines are most of the gap. Leave it undefined to let
   * the estimate float with the set list.
   *
   * Ignored for `amrap` and `flow`, whose duration is `capMinutes`.
   */
  estimatedMinutes?: number;
  notes?: string;
  /** ISO week tag (e.g. "2026-W17"). When set, this template is offered in
   *  that week's pool. Omit to keep it always-available. */
  poolWeek?: string;
  archived?: boolean;
  /** Execution style. Absent means "standard". */
  format?: WorkoutFormat;
  /** AMRAP only — time cap in minutes. `plannedSets` is one round. */
  capMinutes?: number;
  createdAt?: number;
  updatedAt?: number;
}

/** Weekly goals — how many workouts of each category the user targets per
 *  calendar week (Mon-Sun). Hard-coded for now; move to per-user settings
 *  once the model proves out. Together: 6 days with PT work, 4 days strength. */
export const WEEKLY_GOALS: Record<TemplateCategory, number> = {
  "PT Only": 2,
  Full: 4,
};
