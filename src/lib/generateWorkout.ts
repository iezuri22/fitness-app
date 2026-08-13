/**
 * Body-part workout generator.
 *
 * Most of the exercise catalog ships with an empty `muscleGroups` array (the
 * Notion export and home set never filled it in), so targeting is done by
 * keyword-matching the exercise NAME. That also means user-added exercises get
 * classified for free, without anyone tagging them.
 *
 * The generator picks movements for the requested body parts, prefers compound
 * lifts first, respects the equipment available at the chosen location, skips
 * anything flagged banned, and sizes the set count to hit the requested
 * duration.
 */
import type { Exercise, PlannedSet } from "./types";
import { estimatePlannedMinutes } from "./timeEstimate";

export type BodyPart = "chest" | "back" | "shoulders" | "arms" | "legs" | "glutes" | "core";
export type Location = "gym" | "home";
export type Length = "short" | "medium" | "long";

export const BODY_PARTS: { key: BodyPart; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "legs", label: "Legs" },
  { key: "glutes", label: "Glutes" },
  { key: "core", label: "Core" },
];

export const LENGTHS: { key: Length; label: string; minutes: number }[] = [
  { key: "short", label: "Short", minutes: 20 },
  { key: "medium", label: "Medium", minutes: 35 },
  { key: "long", label: "Long", minutes: 50 },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Whole-word containment. Plain `includes` produced real mis-hits — "throw"
 * matched the "row" keyword, "Hip Dip" matched "dip" — so both sides get
 * padded and compared on word boundaries.
 */
const hasPhrase = (haystack: string, phrase: string) =>
  ` ${haystack} `.includes(` ${norm(phrase)} `);

/** Name keywords per body part. Order within a part = rough priority. */
const PART_KEYWORDS: Record<BodyPart, string[]> = {
  chest: ["bench press", "chest press", "chest fly", "pec deck", "cable crossover", "push up", "pushup", "floor press", "incline dumbbell", "bench dip", "parallel bar dip", "dip machine", "assisted dip", "squeeze press"],
  back: ["lat pulldown", "pulldown", "row", "pull up", "pullup", "chin up", "chinup", "rack pull", "shrug", "straight arm", "face pull", "reverse fly", "superman", "inverted row"],
  shoulders: ["shoulder press", "overhead press", "military press", "lateral raise", "front raise", "scaption", "rear delt", "arnold", "plate raise", "landmine press", "cuban press", "halo"],
  arms: ["curl", "tricep", "triceps", "skull crusher", "skullcrusher", "pushdown", "kickback", "bench dip", "parallel bar dip", "dip machine", "assisted dip", "21s"],
  legs: ["squat", "leg press", "leg extension", "leg curl", "lunge", "deadlift", "calf raise", "step up", "step-up", "hack squat", "sissy", "split squat", "box jump", "sled", "stair"],
  glutes: ["hip thrust", "glute", "kickback", "abduction", "romanian deadlift", "rdl", "good morning", "hyperextension", "back extension", "pull through", "clamshell", "frog pump", "bridge"],
  core: ["crunch", "plank", "sit up", "sit-up", "situp", "leg raise", "russian twist", "dead bug", "bird dog", "hollow", "woodchop", "pallof", "mountain climber", "v up", "flutter", "ab roller", "rollout", "carry", "l sit"],
};

/**
 * Phrases that disqualify an exercise from a part even if a keyword hit.
 * "Leg Curl" is not an arm exercise; "Side Plank Hip Dip" is not a chest one.
 */
const PART_VETOES: Partial<Record<BodyPart, string[]>> = {
  arms: ["leg curl", "hamstring curl", "nordic hamstring curl"],
  chest: ["hip dip", "side plank"],
  back: ["throw"],
};

/** Compound lifts earn the top slots — they buy the most per minute. */
const COMPOUND = [
  "squat", "deadlift", "bench press", "row", "pulldown", "pull up", "chin up",
  "press", "lunge", "hip thrust", "leg press", "dip", "rack pull", "clean",
];

/** Equipment that only exists at a commercial gym. */
const GYM_ONLY = [
  "machine", "cable", "barbell", "smith", "sled", "trap bar", "ez bar", "ez-bar",
  "hack squat", "leg press", "lat pulldown", "pec deck", "t bar", "t-bar",
  "stairmaster", "stair climber", "elliptical", "rowing machine", "assault bike",
  "treadmill", "plate", "rack", "landmine", "harness", "dip bars", "parallel bar",
];

/**
 * Body parts an exercise NAME implies.
 *
 * Exported because the soreness recommender has to classify templates, where
 * all it has is `plannedSets[].exerciseName` — no Exercise doc. Sharing this
 * with the generator means "what does this workout hit" gets the same answer
 * in both places, which is the whole point.
 */
export function bodyPartsForName(name: string): BodyPart[] {
  const n = norm(name);
  const hits: BodyPart[] = [];
  for (const [part, words] of Object.entries(PART_KEYWORDS) as [BodyPart, string[]][]) {
    if ((PART_VETOES[part] ?? []).some((v) => hasPhrase(n, v))) continue;
    if (words.some((w) => hasPhrase(n, w))) hits.push(part);
  }
  return hits;
}

function partsFor(ex: Exercise): BodyPart[] {
  const hits = bodyPartsForName(ex.name);
  // Fall back to the exercise's own tags if the name gave nothing away.
  if (!hits.length && ex.muscleGroups?.length) {
    const tags = ex.muscleGroups.map(norm).join(" ");
    if (/chest|pec/.test(tags)) hits.push("chest");
    if (/lat|back|rhomboid|trap/.test(tags)) hits.push("back");
    if (/delt|shoulder|rotator/.test(tags)) hits.push("shoulders");
    if (/bicep|tricep|forearm/.test(tags)) hits.push("arms");
    if (/quad|hamstring|calf|calves|adductor|abductor/.test(tags)) hits.push("legs");
    if (/glute/.test(tags)) hits.push("glutes");
    if (/core|abs|oblique/.test(tags)) hits.push("core");
  }
  return hits;
}

/**
 * Coarse movement family, used to stop a session stacking four variants of the
 * same lift (incline bench + decline bench + close-grip bench + flat bench).
 */
const FAMILIES = [
  "bench press", "chest press", "shoulder press", "overhead press", "pulldown",
  "row", "squat", "deadlift", "hip thrust", "lunge", "curl", "pushdown",
  "tricep", "lateral raise", "front raise", "fly", "dip", "calf raise",
  "leg press", "leg curl", "leg extension", "crunch", "plank",
];
function familyOf(name: string): string | null {
  const n = norm(name);
  return FAMILIES.find((f) => hasPhrase(n, f)) ?? null;
}

const MAX_PER_FAMILY = 2;

function needsGym(ex: Exercise): boolean {
  const hay = norm(`${ex.name} ${(ex.equipment ?? []).join(" ")}`);
  return GYM_ONLY.some((w) => hasPhrase(hay, w));
}

function isCompound(ex: Exercise): boolean {
  const n = norm(ex.name);
  return COMPOUND.some((w) => hasPhrase(n, w));
}

export interface GenerateOptions {
  parts: BodyPart[];
  location: Location;
  length: Length;
  /** Deterministic shuffling seed so "regenerate" produces a different mix. */
  seed?: number;
}

export interface GeneratedWorkout {
  title: string;
  focus: string;
  plannedSets: PlannedSet[];
  exerciseCount: number;
  /** Body parts we couldn't find any exercise for, so the UI can say so. */
  unmatched: BodyPart[];
}

/**
 * Build a workout. Returns `null` if nothing in the library matches, so the
 * caller can show a real message instead of an empty workout.
 */
export function generateWorkout(
  library: Exercise[],
  opts: GenerateOptions
): GeneratedWorkout | null {
  const { parts, location, length, seed = 0 } = opts;
  if (!parts.length) return null;

  const targetMinutes = LENGTHS.find((l) => l.key === length)?.minutes ?? 35;
  const warmupMin = length === "short" ? 4 : length === "medium" ? 5 : 6;
  // Over-pick, then trim against the real estimator below. A formula here was
  // badly off — 3-4 sets at 60-90s rest costs ~2 min per set, so an 8-exercise
  // "35 minute" session actually ran past an hour.
  const exerciseCount = 9;

  const usable = library.filter((ex) => {
    if (ex.isBannedLatarjet) return false;
    if (ex.isPT) return false;
    if (ex.category === "Mobility" || ex.category === "Cardio") return false;
    if (location === "home" && needsGym(ex)) return false;
    return true;
  });

  // Bucket by requested part, compounds first, then a stable seeded rotation so
  // regenerating gives a different-but-sensible mix.
  const byPart = new Map<BodyPart, Exercise[]>();
  const unmatched: BodyPart[] = [];
  for (const part of parts) {
    const pool = usable.filter((ex) => partsFor(ex).includes(part));
    if (!pool.length) { unmatched.push(part); continue; }
    pool.sort((a, b) => {
      const c = Number(isCompound(b)) - Number(isCompound(a));
      if (c !== 0) return c;
      // At the gym prefer barbell/machine work over the band + floor variants
      // that exist for home days; alphabetical order alone buried them.
      if (location === "gym") {
        const g = Number(needsGym(b)) - Number(needsGym(a));
        if (g !== 0) return g;
      }
      return a.name.localeCompare(b.name);
    });
    // Rotate by seed so repeated generates surface different exercises.
    const offset = pool.length ? seed % pool.length : 0;
    byPart.set(part, [...pool.slice(offset), ...pool.slice(0, offset)]);
  }
  if (!byPart.size) return null;

  // Round-robin across the chosen parts so each gets fair representation.
  const picked: { ex: Exercise; part: BodyPart }[] = [];
  const cursors = new Map<BodyPart, number>();
  const live = [...byPart.keys()];
  while (picked.length < exerciseCount && live.length) {
    for (const part of [...live]) {
      if (picked.length >= exerciseCount) break;
      const pool = byPart.get(part)!;
      const i = cursors.get(part) ?? 0;
      if (i >= pool.length) {
        live.splice(live.indexOf(part), 1);
        continue;
      }
      cursors.set(part, i + 1);
      const ex = pool[i];
      if (picked.some((p) => p.ex.id === ex.id)) continue;
      const fam = familyOf(ex.name);
      if (fam) {
        const already = picked.filter((p) => familyOf(p.ex.name) === fam).length;
        if (already >= MAX_PER_FAMILY) continue;
      }
      picked.push({ ex, part });
    }
  }
  if (!picked.length) return null;

  const plannedSets: PlannedSet[] = [];
  let order = 1;

  // Cardio warm-up first — get the blood flowing before loading anything.
  const warmup = library.find((ex) =>
    location === "gym"
      ? /stair climber|stairmaster|stationary bike|rowing machine|elliptical|treadmill/i.test(ex.name)
      : /jump rope|running|mountain climber|bodyweight squat/i.test(ex.name)
  );
  if (warmup) {
    plannedSets.push({
      id: crypto.randomUUID(),
      exerciseId: warmup.id,
      exerciseName: warmup.name,
      order: order++,
      targetReps: warmupMin,
      setType: "Warm-up",
      restSeconds: 0,
      workSeconds: warmupMin * 60,
      completedAt: null,
    });
  }

  for (const { ex } of picked) {
    const compound = isCompound(ex);
    const sets = 3;
    const reps = ex.defaultReps ?? (compound ? 8 : 12);
    for (let i = 0; i < sets; i++) {
      plannedSets.push({
        id: crypto.randomUUID(),
        exerciseId: ex.id,
        exerciseName: ex.name,
        order: order++,
        targetReps: reps,
        targetWeight: ex.defaultWeight,
        setType: "Working",
        restSeconds: compound ? 75 : 60,
        // Deliberately no `estimatedMinutes` — the estimator models working
        // time itself for rep-counted sets, and setting it here double-counts
        // (a flat 2 min/set made a "35 min" session estimate at nearly an hour).
        completedAt: null,
      });
    }
  }

  // Trim whole exercises off the end until the estimate fits the target. Keep
  // at least three so a session never collapses to a token amount of work.
  const minExercises = 3;
  const exerciseOrder = picked.map((p) => p.ex.id);
  while (
    estimatePlannedMinutes({ plannedSets }) > targetMinutes &&
    exerciseOrder.length > minExercises
  ) {
    const dropId = exerciseOrder.pop()!;
    for (let i = plannedSets.length - 1; i >= 0; i--) {
      if (plannedSets[i].exerciseId === dropId && plannedSets[i].setType !== "Warm-up") {
        plannedSets.splice(i, 1);
      }
    }
  }
  plannedSets.forEach((s, i) => { s.order = i + 1; });
  const keptIds = new Set(exerciseOrder);
  const kept = picked.filter((p) => keptIds.has(p.ex.id));

  const labels = parts
    .filter((p) => !unmatched.includes(p))
    .map((p) => BODY_PARTS.find((b) => b.key === p)?.label ?? p);
  const focusText = labels.join(" + ");

  return {
    title: `${location === "gym" ? "Gym" : "Home"} · ${focusText}`,
    focus: `${focusText} · ${location === "gym" ? "Gym" : "Home"}`,
    plannedSets,
    exerciseCount: kept.length,
    unmatched,
  };
}
