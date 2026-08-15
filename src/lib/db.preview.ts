/**
 * In-memory stand-in for `db.ts`, used only by UI preview mode.
 *
 * Run it with:  npm run preview:ui
 *
 * Why this exists: every screen in this app lives behind Firebase auth, so
 * design work on them used to mean either logging in against real data or
 * changing styles blind. This module implements the same surface as `db.ts`
 * against a fixture set, and a dev-only Vite plugin swaps it in. The result
 * is that the *real* page components render with plausible data — no parallel
 * "design mock" screens to drift out of sync with what ships.
 *
 * Never bundled in a production build: the swap is gated on VITE_UI_PREVIEW,
 * which is only set by the preview:ui script.
 */
import type {
  Exercise,
  PlannedSet,
  SetType,
  Workout,
  WorkoutTemplate,
} from "./types";
import { normalizeGoals, type WeeklyGoals } from "./weeklyGoals";
import { resolveStarterTemplates } from "./starterTemplates";
import { NOTION_EXERCISES } from "./notionExercises";
import { GYM_EXERCISES } from "./gymExercises";
import { HOME_EXERCISES } from "./homeExercises";
import { todayStr } from "./dates";
import { cacheKey, cachedRead, invalidate } from "./dbCache";

/* ------------------------------- Fixtures -------------------------------- */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

let seq = 0;
const uid = () => `p${++seq}`;

const EX: Array<[string, Exercise["category"], string[], string[], boolean]> = [
  ["Barbell Back Squat", "Lower Body", ["Barbell", "Rack"], ["Quads", "Glutes"], false],
  ["Romanian Deadlift", "Lower Body", ["Barbell"], ["Hamstrings", "Glutes"], false],
  ["Leg Press", "Lower Body", ["Machine"], ["Quads"], false],
  ["Bench Press", "Upper Body", ["Barbell", "Bench"], ["Chest", "Triceps"], false],
  ["Incline Dumbbell Press", "Upper Body", ["Dumbbells", "Bench"], ["Chest"], false],
  ["Lat Pulldown", "Upper Body", ["Cable"], ["Lats", "Biceps"], false],
  ["Seated Cable Row", "Upper Body", ["Cable"], ["Mid Back"], false],
  ["Overhead Press", "Upper Body", ["Barbell"], ["Shoulders"], false],
  ["Face Pull", "Upper Body", ["Cable"], ["Rear Delts", "Rotator Cuff"], true],
  ["Lateral Raise", "Upper Body", ["Dumbbells"], ["Side Delts"], false],
  ["Band External Rotation", "PT/Rehab", ["Bands"], ["Rotator Cuff"], true],
  ["Scapular Wall Slide", "PT/Rehab", ["Bodyweight"], ["Scapular Stabilizers"], true],
  ["Prone Y-T-W", "PT/Rehab", ["Bodyweight"], ["Lower Traps"], true],
  ["Dead Bug", "Core", ["Bodyweight"], ["Core"], false],
  ["Plank", "Core", ["Bodyweight"], ["Core"], false],
  ["Hanging Knee Raise", "Core", ["Bar"], ["Core", "Hip Flexors"], false],
  ["Couch Stretch", "Mobility", ["Bodyweight"], ["Hip Flexors"], false],
  ["Thoracic Extension", "Mobility", ["Foam Roller"], ["T-Spine"], false],
  ["Treadmill Intervals", "Cardio", ["Treadmill"], ["Full Body"], false],
  ["Kettlebell Swing", "Full Body", ["Kettlebell 20lb"], ["Glutes", "Hamstrings"], false],
];

const handPicked: Exercise[] = EX.map(([name, category, equipment, muscleGroups, isPT]) => ({
  id: uid(),
  name,
  category,
  equipment,
  muscleGroups,
  isPT,
  isBannedLatarjet: false,
  defaultReps: category === "PT/Rehab" ? 12 : 8,
  createdAt: Date.now(),
}));

/**
 * The hand-picked set above drives the fixture workouts (so their names and
 * weights stay readable); the real catalog is appended behind it so the
 * starter templates actually resolve. Without that the preview library would
 * be a handful of half-empty routines.
 */
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const seen = new Set(handPicked.map((e) => normName(e.name)));
const exercises: Exercise[] = [
  ...handPicked,
  ...[...NOTION_EXERCISES, ...GYM_EXERCISES, ...HOME_EXERCISES]
    .filter((e) => {
      const k = normName(e.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((e) => ({ ...e, id: uid(), createdAt: Date.now() })),
];

const byName = (n: string) =>
  exercises.find((e) => e.name === n) ?? exercises[0];

/** Build a run of sets for one exercise. */
function sets(
  name: string,
  count: number,
  reps: number,
  weight: number | undefined,
  setType: SetType = "Working",
  extra: Partial<PlannedSet> = {}
): PlannedSet[] {
  const ex = byName(name);
  return Array.from({ length: count }, () => ({
    id: uid(),
    exerciseId: ex.id,
    exerciseName: ex.name,
    order: 0,
    targetReps: reps,
    targetWeight: weight,
    setType,
    restSeconds: setType === "Working" ? 120 : 45,
    ...extra,
  }));
}

function ordered(list: PlannedSet[]): PlannedSet[] {
  return list.map((s, i) => ({ ...s, order: i + 1 }));
}

const pushDay = () =>
  ordered([
    ...sets("Band External Rotation", 2, 15, 10, "PT/Rehab"),
    ...sets("Scapular Wall Slide", 2, 10, undefined, "PT/Rehab"),
    ...sets("Bench Press", 1, 8, 95, "Warm-up"),
    ...sets("Bench Press", 4, 6, 155),
    ...sets("Incline Dumbbell Press", 3, 10, 50),
    ...sets("Overhead Press", 3, 8, 85),
    ...sets("Lateral Raise", 3, 15, 15),
    ...sets("Plank", 2, 1, undefined, "Working", { workSeconds: 45 }),
  ]);

const pullDay = () =>
  ordered([
    ...sets("Prone Y-T-W", 2, 12, undefined, "PT/Rehab"),
    ...sets("Lat Pulldown", 4, 10, 120),
    ...sets("Seated Cable Row", 4, 10, 130),
    ...sets("Face Pull", 3, 15, 40, "PT/Rehab"),
    ...sets("Hanging Knee Raise", 3, 12, undefined),
  ]);

const legDay = () =>
  ordered([
    ...sets("Barbell Back Squat", 1, 8, 135, "Warm-up"),
    ...sets("Barbell Back Squat", 4, 5, 225),
    ...sets("Romanian Deadlift", 3, 8, 185),
    ...sets("Leg Press", 3, 12, 270),
    ...sets("Couch Stretch", 2, 1, undefined, "Stretch", { workSeconds: 60 }),
  ]);

const ptDay = () =>
  ordered([
    ...sets("Band External Rotation", 3, 15, 10, "PT/Rehab"),
    ...sets("Scapular Wall Slide", 3, 10, undefined, "PT/Rehab"),
    ...sets("Prone Y-T-W", 2, 12, undefined, "PT/Rehab"),
    ...sets("Thoracic Extension", 2, 10, undefined, "Stretch"),
    ...sets("Dead Bug", 3, 10, undefined),
  ]);

const templates: WorkoutTemplate[] = [
  {
    id: uid(), name: "Gym · Push A", focus: "Chest, shoulders & triceps",
    category: "Full", plannedSets: pushDay(), estimatedMinutes: 58,
  },
  {
    id: uid(), name: "Gym · Pull A", focus: "Back & biceps",
    category: "Full", plannedSets: pullDay(), estimatedMinutes: 52,
  },
  {
    id: uid(), name: "Gym · Legs", focus: "Quads, hamstrings & glutes",
    category: "Full", plannedSets: legDay(), estimatedMinutes: 61,
  },
  {
    id: uid(), name: "Morning PT", focus: "Shoulder rehab & mobility",
    category: "PT Only", plannedSets: ptDay(), estimatedMinutes: 22,
  },
  // The real starter pack, resolved against the fixture catalog. Pulling these
  // in rather than hand-writing stand-ins means preview mode exercises the
  // actual named benchmarks and mobility flows — which is the only way to see
  // whether the recommender picks sensibly.
  ...resolveStarterTemplates(exercises.map((e) => ({ id: e.id, name: e.name })))
    .filter((t) => t.plannedSets.length > 0)
    .map((t) => ({
      id: uid(),
      name: t.name,
      focus: t.focus,
      category: t.category,
      notes: t.notes,
      format: t.format,
      capMinutes: t.capMinutes,
      estimatedMinutes: t.estimatedMinutes,
      plannedSets: t.plannedSets,
    })),
];

/** Mark the first `n` sets complete, with lightly varied logged values. */
function logged(list: PlannedSet[], n: number): PlannedSet[] {
  return list.map((s, i) =>
    i < n
      ? {
          ...s,
          completedAt: Date.now() - (n - i) * 90_000,
          actualReps: s.targetReps,
          actualWeight: s.targetWeight,
        }
      : s
  );
}

const workouts: Workout[] = [
  {
    id: "w-today-pt", date: todayStr(), slot: "morning-pt",
    title: "Morning PT", focus: "Shoulder rehab & mobility",
    status: "completed", category: "PT Only",
    plannedSets: logged(ptDay(), 99),
    startedAt: Date.now() - 7_200_000, completedAt: Date.now() - 5_400_000,
    createdAt: Date.now() - 7_300_000,
  },
  {
    id: "w-today-str", date: todayStr(), slot: "strength",
    title: "Gym · Push A", focus: "Chest, shoulders & triceps",
    status: "in_progress", category: "Full",
    plannedSets: logged(pushDay(), 7),
    startedAt: Date.now() - 1_500_000,
    createdAt: Date.now() - 1_600_000,
  },
  ...[
    ["Gym · Legs", "Quads, hamstrings & glutes", legDay, 1],
    ["Morning PT", "Shoulder rehab & mobility", ptDay, 2],
    ["Gym · Pull A", "Back & biceps", pullDay, 3],
    ["Morning PT", "Shoulder rehab & mobility", ptDay, 4],
    ["Gym · Push A", "Chest, shoulders & triceps", pushDay, 6],
    ["Gym · Legs", "Quads, hamstrings & glutes", legDay, 8],
  ].map(([title, focus, build, ago]) => {
    const isPT = (title as string).includes("PT");
    return {
      id: uid(),
      date: daysAgo(ago as number),
      slot: (isPT ? "morning-pt" : "strength") as Workout["slot"],
      title: title as string,
      focus: focus as string,
      status: "completed" as const,
      category: (isPT ? "PT Only" : "Full") as Workout["category"],
      plannedSets: logged((build as () => PlannedSet[])(), 99),
      startedAt: Date.now() - (ago as number) * 86_400_000,
      completedAt: Date.now() - (ago as number) * 86_400_000 + 3_000_000,
      createdAt: Date.now() - (ago as number) * 86_400_000,
    };
  }),
];

// One AMRAP sitting ready for today, so the scored-benchmark runner is
// reachable in preview without having to start one first.
const ify = templates.find((t) => t.name === "AMRAP · Ify");
if (ify) {
  workouts.push({
    id: "w-today-amrap",
    date: todayStr(),
    slot: "strength",
    title: ify.name,
    focus: ify.focus,
    status: "planned",
    category: ify.category,
    fromTemplateId: ify.id,
    format: "amrap",
    capMinutes: ify.capMinutes,
    plannedSets: ify.plannedSets.map((s, i) => ({ ...s, id: uid(), order: i + 1 })),
    createdAt: Date.now() - 60_000,
  });
}

// …and one mobility flow, so the guided timer is reachable too.
const flow = templates.find((t) => t.name === "Stretch · 5 min Hips");
if (flow) {
  workouts.push({
    id: "w-today-flow",
    date: todayStr(),
    slot: "morning-pt",
    title: flow.name,
    focus: flow.focus,
    status: "planned",
    category: flow.category,
    fromTemplateId: flow.id,
    format: "flow",
    capMinutes: flow.capMinutes,
    plannedSets: flow.plannedSets.map((s, i) => ({ ...s, id: uid(), order: i + 1 })),
    createdAt: Date.now() - 30_000,
  });
}

// A planned standard workout whose exercises have history, so the targets
// review has something to propose in preview.
workouts.push({
  id: "w-today-plan",
  date: todayStr(),
  slot: "strength",
  title: "Gym · Pull A",
  focus: "Back & biceps",
  status: "planned",
  category: "Full",
  plannedSets: pullDay(),
  createdAt: Date.now() - 30_000,
});

let goals: WeeklyGoals = normalizeGoals({ gym: 3, amrap: 1, home: 1, pt: 4, class: 0 });

/* ------------------------------ Same API as db --------------------------- */

// Deep-copy so callers can't mutate the fixture store by holding a reference.
// undefined has no JSON representation, so void-returning calls pass straight
// through rather than blowing up in JSON.parse.
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const wait = <T,>(v: T): Promise<T> =>
  new Promise((r) => setTimeout(() => r(clone(v)), 120));

export async function listExercises(uid: string) {
  return cachedRead(cacheKey.exercises(uid), () =>
    wait([...exercises].sort((a, b) => a.name.localeCompare(b.name)))
  );
}
export async function createExercise(
  userId: string,
  data: Omit<Exercise, "id" | "createdAt" | "updatedAt">
) {
  const id = uid();
  exercises.push({ ...data, id, createdAt: Date.now() });
  invalidate(cacheKey.exercises(userId));
  return wait(id);
}
export async function updateExercise(userId: string, id: string, patch: Partial<Exercise>) {
  const i = exercises.findIndex((e) => e.id === id);
  if (i >= 0) exercises[i] = { ...exercises[i], ...patch, updatedAt: Date.now() };
  invalidate(cacheKey.exercises(userId));
  return wait(undefined as void);
}
export async function deleteExercise(userId: string, id: string) {
  const i = exercises.findIndex((e) => e.id === id);
  if (i >= 0) exercises.splice(i, 1);
  invalidate(cacheKey.exercises(userId));
  return wait(undefined as void);
}
export async function uploadExerciseGif() {
  return wait("");
}
export async function removeExerciseGif() {
  return wait(undefined as void);
}
export function countMissingCatalog() {
  return 0;
}
export async function importMissingNotionExercises() {
  return wait(0);
}

export async function getWorkout(_uid: string, id: string) {
  return wait(workouts.find((w) => w.id === id) ?? null);
}
export async function getWorkoutByDate(_uid: string, date: string) {
  return wait(workouts.find((w) => w.date === date) ?? null);
}
export async function getWorkoutsByDate(_uid: string, date: string) {
  const rank = (w: Workout) =>
    w.slot === "morning-pt" ? 0 : w.slot === "strength" ? 1 : 2;
  return wait(workouts.filter((w) => w.date === date).sort((a, b) => rank(a) - rank(b)));
}
export async function listWorkouts(uid: string, opts: { limit?: number } = {}) {
  return cachedRead(cacheKey.workoutList(uid, opts.limit ?? 0), () => {
    const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
    return wait(opts.limit ? sorted.slice(0, opts.limit) : sorted);
  });
}
export async function createWorkout(
  userId: string,
  data: Omit<Workout, "id" | "createdAt" | "updatedAt">
) {
  const id = uid();
  workouts.push({ ...data, id, createdAt: Date.now() });
  invalidate(cacheKey.workouts(userId));
  return wait(id);
}
export async function saveWorkout(userId: string, id: string, data: Partial<Workout>) {
  const i = workouts.findIndex((w) => w.id === id);
  if (i >= 0) workouts[i] = { ...workouts[i], ...data, updatedAt: Date.now() };
  invalidate(cacheKey.workouts(userId));
  return wait(undefined as void);
}
export async function deleteWorkout(userId: string, id: string) {
  const i = workouts.findIndex((w) => w.id === id);
  if (i >= 0) workouts.splice(i, 1);
  invalidate(cacheKey.workouts(userId));
  return wait(undefined as void);
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  date: string;
  workoutTitle: string;
  actualReps?: number;
  actualWeight?: number;
  setType: string;
  userNotes?: string;
}
export async function getExerciseHistory(_uid: string, exerciseId: string, max = 10) {
  const out: ExerciseHistoryEntry[] = [];
  for (const w of [...workouts].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const s of w.plannedSets) {
      if (s.exerciseId !== exerciseId || !s.completedAt) continue;
      out.push({
        workoutId: w.id, date: w.date, workoutTitle: w.title,
        actualReps: s.actualReps, actualWeight: s.actualWeight, setType: s.setType,
      });
      if (out.length >= max) return wait(out);
    }
  }
  return wait(out);
}

export interface SupplementItem {
  id: string;
  name: string;
  order: number;
}
let supplements: SupplementItem[] = [
  { id: "s1", name: "Vitamin D", order: 0 },
  { id: "s2", name: "Protein shake", order: 1 },
  { id: "s3", name: "Creatine", order: 2 },
  { id: "s4", name: "Omega-3", order: 3 },
];
// A few days of history so the streak has something to count.
const supplementLogs: Record<string, string[]> = {
  [todayStr()]: ["s1", "s2"],
  [daysAgo(1)]: ["s1", "s2", "s3", "s4"],
  [daysAgo(2)]: ["s1", "s2", "s3", "s4"],
  [daysAgo(3)]: ["s1", "s2", "s3"],
  [daysAgo(5)]: ["s1"],
};

export async function getSupplements() {
  return wait([...supplements].sort((a, b) => a.order - b.order));
}
export async function saveSupplements(_uid: string, items: SupplementItem[]) {
  supplements = items.map((it, i) => ({ ...it, order: i }));
  return wait(undefined as void);
}
export async function getSupplementLog(_uid: string, date: string) {
  return wait(supplementLogs[date] ?? []);
}
export async function saveSupplementLog(_uid: string, date: string, taken: string[]) {
  supplementLogs[date] = taken;
  return wait(undefined as void);
}
export async function listSupplementLogs(_uid: string, start: string, end: string) {
  const out: Record<string, string[]> = {};
  for (const [d, v] of Object.entries(supplementLogs)) {
    if (d >= start && d <= end) out[d] = v;
  }
  return wait(out);
}

export async function getWeeklyGoals() {
  return wait(goals);
}
export async function saveWeeklyGoals(_uid: string, next: WeeklyGoals) {
  goals = normalizeGoals(next);
  return wait(undefined as void);
}

export interface AmrapResult {
  workoutId: string;
  date: string;
  rounds: number;
  extraReps?: number;
  capMinutes?: number;
}
export async function getAmrapHistory() {
  return wait([
    { workoutId: "a1", date: daysAgo(5), rounds: 14, extraReps: 6, capMinutes: 20 },
    { workoutId: "a2", date: daysAgo(12), rounds: 13, extraReps: 2, capMinutes: 20 },
    { workoutId: "a3", date: daysAgo(19), rounds: 12, capMinutes: 20 },
  ] as AmrapResult[]);
}

export async function listTemplates(uid: string) {
  return cachedRead(cacheKey.templates(uid), () =>
    wait([...templates].sort((a, b) => a.name.localeCompare(b.name)))
  );
}
export async function getTemplate(_uid: string, id: string) {
  return wait(templates.find((t) => t.id === id) ?? null);
}
export async function createTemplate(
  userId: string,
  data: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt">
) {
  const id = uid();
  templates.push({ ...data, id, createdAt: Date.now() });
  invalidate(cacheKey.templates(userId));
  return wait(id);
}
export async function saveTemplate(
  userId: string,
  id: string,
  data: Partial<WorkoutTemplate> & { estimatedMinutes?: number | null; capMinutes?: number | null }
) {
  const i = templates.findIndex((t) => t.id === id);
  if (i >= 0) {
    const next = { ...templates[i], ...data, updatedAt: Date.now() } as Record<string, unknown>;
    // Match the real db: `null` removes the field rather than storing a null.
    for (const [k, v] of Object.entries(data)) if (v === null) delete next[k];
    templates[i] = next as unknown as WorkoutTemplate;
  }
  invalidate(cacheKey.templates(userId));
  return wait(undefined as void);
}
export async function deleteTemplate(userId: string, id: string) {
  const i = templates.findIndex((t) => t.id === id);
  if (i >= 0) templates.splice(i, 1);
  invalidate(cacheKey.templates(userId));
  return wait(undefined as void);
}
export async function startWorkoutFromTemplate(
  userId: string,
  template: WorkoutTemplate,
  opts: { slot?: Workout["slot"]; date?: string } = {}
) {
  const id = uid();
  workouts.push({
    id,
    date: opts.date ?? todayStr(),
    slot: opts.slot ?? (template.category === "PT Only" ? "morning-pt" : "strength"),
    title: template.name,
    focus: template.focus,
    status: "planned",
    plannedSets: template.plannedSets.map((s, i) => ({
      ...s, id: uid(), order: i + 1, completedAt: null,
    })),
    category: template.category,
    fromTemplateId: template.id,
    format: template.format,
    capMinutes: template.capMinutes,
    estimatedMinutes: template.estimatedMinutes,
    createdAt: Date.now(),
  });
  invalidate(cacheKey.workouts(userId));
  return wait(id);
}

export async function listWorkoutsInRange(uid: string, start: string, end: string) {
  return cachedRead(cacheKey.workoutRange(uid, start, end), () =>
    wait(workouts.filter((w) => w.date >= start && w.date <= end))
  );
}

export function serverTimestamp() {
  return Date.now();
}
