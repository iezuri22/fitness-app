import type { Workout, WorkoutTemplate } from "./types";
import { kindOf, type WorkoutKind } from "./weeklyGoals";

/**
 * What the planner learns from what you actually did.
 *
 * The planner proposes a week; you then edit it — finishing some sessions,
 * skipping others, deleting the ones you never wanted, and pulling exercises
 * out of the ones you keep. All of that is an opinion, and none of it was
 * being read back. This turns it into two things the planner can act on:
 * which routines to offer again, and which exercises to stop putting in them.
 *
 * Deletion needs recording explicitly. Finishing a workout leaves a completed
 * document behind; deleting one leaves nothing at all, so the single clearest
 * "not this" signal was the one that vanished without trace. `recordSignal` in
 * lib/db writes a small entry at the three places a planned session can be
 * thrown away.
 */

export type SignalAction = "deleted" | "replaced";

export interface TrainingSignal {
  /** When it happened. */
  at: number;
  /** The day the discarded session was scheduled for. */
  date: string;
  /** Template name — the stable handle. Ids differ between seed and library. */
  templateName: string;
  kind: WorkoutKind;
  action: SignalAction;
}

/** How far back an opinion still counts. Beyond this you've moved on. */
const LOOKBACK_DAYS = 56;

/**
 * Weights, in "sessions". Deleting a session you never started is the loudest
 * thing you can say about it, so it outweighs a completion. Skipping is softer
 * — life happens — and letting a planned day slide past is softer still.
 */
const WEIGHT = {
  completed: 1,
  skipped: -1,
  abandoned: -0.5,
  deleted: -2.5,
  replaced: -1.5,
} as const;

/**
 * Below this a routine stops being offered — actively unwanted, not merely
 * unloved. Calibrated against the weights above so that it takes a repeated
 * opinion, never a single bad day:
 *
 *   two deletions      -5.0   → stops being offered
 *   one deletion       -2.5   → demoted, still on the table
 *   three swaps        -4.5   → stops
 *   four skips         -4.0   → stops
 *
 * A completed session is +1, so a routine you mostly do and once deleted in a
 * bad week climbs back out on its own.
 */
const REJECTED_BELOW = -4;

/**
 * How many times you have to remove an exercise from a routine before the
 * planner believes you. Once is a busy day; twice is a preference.
 */
const DROP_AFTER = 2;

export interface Preferences {
  /** Net opinion per routine name. Positive = do it again. */
  scoreByName: Map<string, number>;
  /** Exercise names you keep taking out, per routine name. */
  droppedByTemplate: Map<string, Set<string>>;
  /** Score for a template, 0 when there's nothing to go on. */
  score(name: string): number;
  /** True when you've said no to this often enough to mean it. */
  isRejected(name: string): boolean;
  /** Exercises to leave out when scheduling this routine. */
  dropped(name: string): Set<string>;
  /** Everything that fed the scores, newest first — for showing your work. */
  evidence: { name: string; score: number; completed: number; rejected: number }[];
}

export function derivePreferences(opts: {
  /** Workout history, ideally the last couple of months. */
  workouts: Workout[];
  /** Deletion log from lib/db. */
  signals: TrainingSignal[];
  /** The library, used to tell which exercises a routine *should* contain. */
  templates: WorkoutTemplate[];
  /** Today, so a planned day in the future isn't counted as abandoned. */
  today: string;
}): Preferences {
  const { workouts, signals, templates, today } = opts;
  const cutoff = addDays(today, -LOOKBACK_DAYS);

  const scoreByName = new Map<string, number>();
  const completedBy = new Map<string, number>();
  const rejectedBy = new Map<string, number>();
  const bump = (name: string, by: number) =>
    scoreByName.set(name, (scoreByName.get(name) ?? 0) + by);

  for (const w of workouts) {
    if (!w.title || w.date < cutoff) continue;
    if (w.status === "completed") {
      bump(w.title, WEIGHT.completed);
      completedBy.set(w.title, (completedBy.get(w.title) ?? 0) + 1);
    } else if (w.status === "skipped") {
      bump(w.title, WEIGHT.skipped);
      rejectedBy.set(w.title, (rejectedBy.get(w.title) ?? 0) + 1);
    } else if (w.status === "planned" && w.date < today) {
      // Scheduled, the day came and went, never started.
      bump(w.title, WEIGHT.abandoned);
    }
  }

  for (const s of signals) {
    if (s.date < cutoff) continue;
    bump(s.templateName, WEIGHT[s.action]);
    rejectedBy.set(s.templateName, (rejectedBy.get(s.templateName) ?? 0) + 1);
  }

  // Which exercises you take out of a routine you keep. Only completed
  // sessions count — a workout you abandoned says nothing about its contents.
  const byName = new Map(templates.map((t) => [t.name, t]));
  const removals = new Map<string, Map<string, number>>();
  for (const w of workouts) {
    if (w.status !== "completed" || w.date < cutoff) continue;
    const template = byName.get(w.title);
    if (!template) continue;
    const kept = new Set((w.plannedSets ?? []).map((s) => s.exerciseName));
    const expected = new Set((template.plannedSets ?? []).map((s) => s.exerciseName));
    for (const name of expected) {
      if (kept.has(name)) continue;
      const perTemplate = removals.get(w.title) ?? new Map<string, number>();
      perTemplate.set(name, (perTemplate.get(name) ?? 0) + 1);
      removals.set(w.title, perTemplate);
    }
  }
  const droppedByTemplate = new Map<string, Set<string>>();
  for (const [templateName, counts] of removals) {
    const dropped = new Set<string>();
    for (const [exercise, n] of counts) if (n >= DROP_AFTER) dropped.add(exercise);
    if (dropped.size) droppedByTemplate.set(templateName, dropped);
  }

  const evidence = [...scoreByName.entries()]
    .map(([name, score]) => ({
      name,
      score,
      completed: completedBy.get(name) ?? 0,
      rejected: rejectedBy.get(name) ?? 0,
    }))
    .sort((a, b) => a.score - b.score);

  return {
    scoreByName,
    droppedByTemplate,
    score: (name) => scoreByName.get(name) ?? 0,
    isRejected: (name) => (scoreByName.get(name) ?? 0) <= REJECTED_BELOW,
    dropped: (name) => droppedByTemplate.get(name) ?? new Set<string>(),
    evidence,
  };
}

/** An empty set of opinions, for a first run or a failed load. */
export const NO_PREFERENCES: Preferences = {
  scoreByName: new Map(),
  droppedByTemplate: new Map(),
  score: () => 0,
  isRejected: () => false,
  dropped: () => new Set<string>(),
  evidence: [],
};

/** Build the signal for a session being thrown away. */
export function signalFor(w: Workout, action: SignalAction): TrainingSignal {
  return {
    at: Date.now(),
    date: w.date,
    templateName: w.title,
    kind: kindOf(w),
    action,
  };
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
