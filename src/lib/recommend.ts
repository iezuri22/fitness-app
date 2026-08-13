/**
 * "I'm sore — what should I do today?"
 *
 * Turns a set of sore body parts into one concrete recommendation, drawn from
 * the user's own template library rather than invented on the spot. The rules
 * are deliberately simple and legible, because a recommendation you can't
 * second-guess is one you stop trusting:
 *
 *   1. Sore muscles get trained *less*, not avoided entirely — one sore area
 *      shouldn't cancel a session that mostly hits fresh ones.
 *   2. Nearly-everything sore is a recovery day. Saying "train anyway" there
 *      would be the app being agreeable rather than useful.
 *   3. What you did in the last few days matters as much as what aches — the
 *      soreness you feel today lags the session that caused it.
 *   4. Mobility for the sore areas is always offered, even on a training day.
 */
import { BODY_PARTS, bodyPartsForName, type BodyPart } from "./generateWorkout";
import { estimatePlannedMinutes } from "./timeEstimate";
import type { Workout, WorkoutTemplate } from "./types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hasPhrase = (hay: string, p: string) => ` ${hay} `.includes(` ${norm(p)} `);

/**
 * Which area a *stretch* addresses. The generator's classifier is tuned for
 * loaded movements ("bench press", "lateral raise") and gets almost nothing
 * from mobility names, so targeting needs its own vocabulary.
 */
const STRETCH_TARGETS: Record<BodyPart, string[]> = {
  shoulders: ["shoulder", "thoracic", "thread the needle", "doorway", "cross body", "pulley", "serratus", "scapular", "sleeper"],
  chest: ["chest", "doorway", "cobra", "camel", "seal", "locust"],
  back: ["thoracic", "cat cow", "child", "pose", "thread the needle", "back stretch", "seal", "plow"],
  arms: ["tricep", "wrist", "forearm"],
  legs: ["hamstring", "quad", "calf", "couch", "malasana", "garland", "frog", "butterfly", "titli", "90 90", "lunge", "warrior", "triangle"],
  glutes: ["glute", "figure four", "pigeon", "kapotasana", "90 90", "frog", "hip"],
  core: ["cobra", "cat cow", "seal", "child", "bhujangasana", "abdominal"],
};

function stretchTargets(name: string): BodyPart[] {
  const n = norm(name);
  return (Object.keys(STRETCH_TARGETS) as BodyPart[]).filter((p) =>
    STRETCH_TARGETS[p].some((w) => hasPhrase(n, w))
  );
}

/** True for the short mobility flows and PT-only routines. */
function isMobility(t: WorkoutTemplate): boolean {
  const hay = norm(`${t.name} ${t.focus}`);
  if (/stretch|mobility|yoga/.test(hay)) return true;
  const sets = t.plannedSets ?? [];
  if (sets.length === 0) return false;
  return sets.every((s) => s.setType === "Stretch" || s.setType === "PT/Rehab");
}

/**
 * How many sets a template devotes to each body part. Set-weighted rather than
 * exercise-weighted, so five sets of squats count as more leg work than one.
 */
export function templateLoad(t: WorkoutTemplate): Record<BodyPart, number> {
  const load = Object.fromEntries(BODY_PARTS.map((b) => [b.key, 0])) as Record<BodyPart, number>;
  for (const s of t.plannedSets ?? []) {
    for (const p of bodyPartsForName(s.exerciseName)) load[p] += 1;
  }
  return load;
}

/** Body parts trained in the given workouts, set-weighted. */
function recentLoad(workouts: Workout[]): Record<BodyPart, number> {
  const load = Object.fromEntries(BODY_PARTS.map((b) => [b.key, 0])) as Record<BodyPart, number>;
  for (const w of workouts) {
    for (const s of w.plannedSets ?? []) {
      if (!s.completedAt) continue;
      for (const p of bodyPartsForName(s.exerciseName)) load[p] += 1;
    }
  }
  return load;
}

export interface Suggestion {
  template: WorkoutTemplate;
  minutes: number;
  /** Plain-language reason, shown under the name. */
  reason: string;
  score: number;
}

export interface Recommendation {
  /** Headline — the actual answer to "what should I do". */
  verdict: string;
  /** One sentence of why, so the call is auditable. */
  rationale: string;
  /** The session to do. Absent on a full recovery day. */
  primary?: Suggestion;
  /** Mobility for the sore areas. Always offered when anything is sore. */
  mobility?: Suggestion;
  /** Next-best training options. */
  alternatives: Suggestion[];
  /** True when the advice is "don't train hard today". */
  restDay: boolean;
}

export interface RecommendInput {
  sore: BodyPart[];
  templates: WorkoutTemplate[];
  /** Recent workouts, newest first — used for the last-few-days lookback. */
  recent: Workout[];
  /** Optional ceiling in minutes. Undefined means no constraint. */
  maxMinutes?: number;
  /** Today, as YYYY-MM-DD. Injected so this stays pure and testable. */
  today: string;
}

/** Days between two YYYY-MM-DD strings. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000
  );
}

const label = (p: BodyPart) =>
  BODY_PARTS.find((b) => b.key === p)?.label.toLowerCase() ?? p;

/** "chest and back" / "chest, back and legs" */
export function joinParts(parts: BodyPart[]): string {
  const l = parts.map(label);
  if (l.length === 0) return "nothing";
  if (l.length === 1) return l[0];
  return `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`;
}

export function recommend({
  sore,
  templates,
  recent,
  maxMinutes,
  today,
}: RecommendInput): Recommendation {
  const soreSet = new Set(sore);
  const active = templates.filter((t) => !t.archived && (t.plannedSets ?? []).length > 0);
  const mobilityPool = active.filter(isMobility);
  const trainingPool = active.filter((t) => !isMobility(t));

  // Sessions finished in the last 3 days — recent enough that repeating the
  // same muscles is the thing making you sore in the first place.
  const lastThreeDays = recent.filter(
    (w) => w.status === "completed" && daysBetween(today, w.date) <= 3 && daysBetween(today, w.date) >= 0
  );
  const worked = recentLoad(lastThreeDays);
  const doneNames = new Set(lastThreeDays.map((w) => norm(w.title)));

  // --- Mobility pick: whichever flow best covers the sore areas. ---
  const mobility = pickMobility(mobilityPool, sore, maxMinutes);

  // --- Rule 2: nearly everything sore → recovery day. ---
  if (soreSet.size >= 5) {
    return {
      verdict: "Take a recovery day",
      rationale: `You've flagged ${soreSet.size} of ${BODY_PARTS.length} areas as sore. Loading anything today mostly buys fatigue — move, don't train.`,
      mobility,
      alternatives: [],
      restDay: true,
    };
  }

  const scored: Suggestion[] = trainingPool
    .map((t) => {
      const load = templateLoad(t);
      const minutes = estimatePlannedMinutes(t);
      const totalSets = Object.values(load).reduce((a, b) => a + b, 0) || 1;

      let score = 0;
      const freshHit: BodyPart[] = [];
      const soreHit: BodyPart[] = [];

      for (const { key } of BODY_PARTS) {
        const sets = load[key];
        if (sets === 0) continue;
        if (soreSet.has(key)) {
          // Rule 1: proportional penalty. A session that grazes a sore area
          // survives; one built around it does not.
          score -= 4 * sets;
          soreHit.push(key);
        } else {
          score += 2 * sets;
          freshHit.push(key);
          // Rule 3: reward areas that haven't been touched lately.
          if (worked[key] === 0) score += 1.5 * sets;
        }
      }
      score = score / totalSets; // normalize so long templates don't just win

      // Don't hand back the same session two days running.
      if (doneNames.has(norm(t.name))) score -= 6;

      if (maxMinutes && minutes > maxMinutes) score -= 8;

      const reason = soreHit.length
        ? `Hits ${joinParts(freshHit)}; some ${joinParts(soreHit)} work`
        : freshHit.length
        ? `All fresh — ${joinParts(freshHit)}`
        : "General session";

      return { template: t, minutes, reason, score };
    })
    .sort((a, b) => b.score - a.score);

  const primary = scored[0];

  // Nothing scored positively — every template leans on something sore.
  if (!primary || primary.score <= 0) {
    return {
      verdict: "Go light today",
      rationale: sore.length
        ? `Everything in your library leans on ${joinParts(sore)} right now. Mobility today, train tomorrow.`
        : "Nothing in your library fits the time you've got. Mobility is the better use of today.",
      mobility,
      alternatives: scored.slice(0, 2),
      restDay: true,
    };
  }

  const verdict = sore.length
    ? `Train ${joinParts(freshOf(primary))} today`
    : "You're good to train";
  const rationale = sore.length
    ? `${joinParts(sore)} ${sore.length === 1 ? "is" : "are"} sore, so this picks a session that mostly works around ${sore.length === 1 ? "it" : "them"}.`
    : "Nothing flagged sore — this is the session that best fits what you haven't trained lately.";

  return {
    verdict,
    rationale,
    primary,
    mobility,
    alternatives: scored.slice(1, 4).filter((s) => s.score > 0),
    restDay: false,
  };

  function freshOf(s: Suggestion): BodyPart[] {
    const load = templateLoad(s.template);
    return BODY_PARTS.map((b) => b.key).filter((k) => load[k] > 0 && !soreSet.has(k));
  }
}

/** Best mobility flow for the sore areas, preferring ones that fit the clock. */
function pickMobility(
  pool: WorkoutTemplate[],
  sore: BodyPart[],
  maxMinutes?: number
): Suggestion | undefined {
  if (pool.length === 0) return undefined;
  const soreSet = new Set(sore);

  const scored = pool
    .map((t) => {
      const minutes = estimatePlannedMinutes(t);
      let hits = 0;
      const covered = new Set<BodyPart>();
      for (const s of t.plannedSets ?? []) {
        for (const p of stretchTargets(s.exerciseName)) {
          if (soreSet.has(p)) {
            hits += 1;
            covered.add(p);
          }
        }
      }
      // Coverage breadth beats raw hit count — a flow touching both sore areas
      // is better than one hammering a single area ten times.
      let score = covered.size * 10 + hits;
      // With nothing sore, favour the short general flows over a 25-min routine.
      if (soreSet.size === 0) score += Math.max(0, 20 - minutes);
      if (maxMinutes && minutes > maxMinutes) score -= 15;

      const reason = covered.size
        ? `Targets ${joinParts([...covered])}`
        : `${Math.round(minutes)} min general mobility`;
      return { template: t, minutes, reason, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0];
}
