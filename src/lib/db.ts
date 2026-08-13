/**
 * Firestore helpers. Data is scoped per-user under /users/{uid}/{collection}.
 * Security rules (firestore.rules) enforce that users can only touch their own subtree.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  documentId,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import { cacheKey, cachedRead, invalidate } from "./dbCache";
import type { Exercise, PlannedSet, Workout, WorkoutTemplate } from "./types";
import { todayStr } from "./dates";
import { NOTION_EXERCISES } from "./notionExercises";
import { HOME_EXERCISES } from "./homeExercises";
import { GYM_EXERCISES } from "./gymExercises";
import { findGifForName } from "./exerciseGifs";
import { normalizeGoals, type WeeklyGoals } from "./weeklyGoals";

// Path helpers
const userRoot = (uid: string) => `users/${uid}`;
const exercisesPath = (uid: string) => `${userRoot(uid)}/exercises`;
const workoutsPath = (uid: string) => `${userRoot(uid)}/workouts`;
const templatesPath = (uid: string) => `${userRoot(uid)}/templates`;

// ---------- Exercises ----------

export async function listExercises(uid: string): Promise<Exercise[]> {
  return cachedRead(cacheKey.exercises(uid), async () => {
    const snap = await getDocs(
      query(collection(db, exercisesPath(uid)), orderBy("name"))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, "id">) }));
  });
}

export async function createExercise(
  uid: string,
  data: Omit<Exercise, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, exercisesPath(uid)), {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  invalidate(cacheKey.exercises(uid));
  return ref.id;
}

export async function updateExercise(
  uid: string,
  id: string,
  patch: Partial<Exercise>
): Promise<void> {
  await updateDoc(doc(db, exercisesPath(uid), id), {
    ...patch,
    updatedAt: Date.now(),
  });
  invalidate(cacheKey.exercises(uid));
}

export async function deleteExercise(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, exercisesPath(uid), id));
  invalidate(cacheKey.exercises(uid));
}

/**
 * Upload a user-provided GIF/PNG/JPG for an exercise, store it in Firebase
 * Storage at `users/{uid}/exercise-gifs/{exerciseId}.<ext>`, then patch the
 * exercise doc with the public download URL.
 *
 * Throws a human-readable error if Storage isn't configured in the project.
 */
export async function uploadExerciseGif(
  uid: string,
  exerciseId: string,
  file: File
): Promise<string> {
  // Validate type — keep it to animated/static image formats the <img> tag handles.
  const allowed = ["image/gif", "image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error(
      `Unsupported file type "${file.type || "unknown"}". Use GIF, PNG, JPG, or WebP.`
    );
  }
  // 20MB cap — realistic for exercise demo GIFs, keeps Storage bills predictable.
  const MAX_BYTES = 20 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)}MB; max is 20MB.`
    );
  }
  const extFromType: Record<string, string> = {
    "image/gif": "gif",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const ext = extFromType[file.type];
  const path = `users/${uid}/exercise-gifs/${exerciseId}.${ext}`;
  const ref = storageRef(storage, path);
  try {
    await uploadBytes(ref, file, { contentType: file.type });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("storage/unauthorized") || msg.includes("unauthorized")) {
      throw new Error(
        "Upload blocked by Firebase Storage rules. Deploy storage.rules with `firebase deploy --only storage`, or paste it in Firebase Console → Storage → Rules."
      );
    }
    if (msg.includes("storage/unknown") || msg.includes("bucket")) {
      throw new Error(
        "Firebase Storage isn't set up on this project, so in-app uploads can't work. " +
          "Easier route: drop the file into the app's `demo-inbox` folder on your laptop " +
          "and run `npm run add-demos` — it bundles the demo like the built-in ones."
      );
    }
    throw e;
  }
  const url = await getDownloadURL(ref);
  await updateExercise(uid, exerciseId, { gifUrl: url });
  return url;
}

/** Remove any user-uploaded GIF for an exercise (best-effort — ignores 404s). */
export async function removeExerciseGif(uid: string, exerciseId: string): Promise<void> {
  for (const ext of ["gif", "png", "jpg", "webp"]) {
    try {
      await deleteObject(storageRef(storage, `users/${uid}/exercise-gifs/${exerciseId}.${ext}`));
    } catch {
      // ignore missing files
    }
  }
  await updateExercise(uid, exerciseId, { gifUrl: undefined });
}

/**
 * Combined catalog: Notion export (92) + curated home-workout hypertrophy set
 * (200+) + commercial-gym set (barbell/machine/cable/cardio). Home set is
 * filtered for Latarjet constraints (no behind-neck, no deep flys, etc.).
 */
const CATALOG: typeof NOTION_EXERCISES = dedupeByName([
  ...NOTION_EXERCISES,
  ...HOME_EXERCISES,
  ...GYM_EXERCISES,
]);

function dedupeByName<T extends { name: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of list) {
    const k = normalizeExerciseName(e.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** How many catalog entries aren't yet in the user's library. */
export function countMissingCatalog(existing: Exercise[]): number {
  const have = new Set(existing.map((e) => normalizeExerciseName(e.name)));
  return CATALOG.filter((c) => !have.has(normalizeExerciseName(c.name))).length;
}

/**
 * One-shot import of the full catalog (Notion + curated home hypertrophy).
 * De-dupes by normalized name against whatever's already in the user's library
 * and only creates the missing ones. Safe to re-run — won't duplicate.
 * Returns the count of exercises actually created.
 */
export async function importMissingNotionExercises(uid: string): Promise<number> {
  const existing = await listExercises(uid);
  const existingKeys = new Set(existing.map((e) => normalizeExerciseName(e.name)));
  let created = 0;
  for (const seed of CATALOG) {
    if (existingKeys.has(normalizeExerciseName(seed.name))) continue;
    // Prebake gifUrl so imports show demos immediately (same as first-run seed).
    const gifUrl = seed.gifUrl ?? findGifForName(seed.name);
    await createExercise(uid, gifUrl ? { ...seed, gifUrl } : seed);
    created++;
  }
  return created;
}

function normalizeExerciseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------- Workouts ----------

export async function getWorkout(uid: string, id: string): Promise<Workout | null> {
  const snap = await getDoc(doc(db, workoutsPath(uid), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Workout, "id">) };
}

export async function getWorkoutByDate(
  uid: string,
  date: string
): Promise<Workout | null> {
  const snap = await getDocs(
    query(collection(db, workoutsPath(uid)), where("date", "==", date), limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Workout, "id">) };
}

/**
 * Returns all workouts on a given date. With the new two-slot rhythm a day
 * can have a morning PT session plus a later strength session — both are
 * distinct docs with the same `date` field and different `slot` values.
 *
 * Ordering: morning-pt first, then strength, then any legacy doc with no
 * slot tag.
 */
export async function getWorkoutsByDate(
  uid: string,
  date: string
): Promise<Workout[]> {
  const snap = await getDocs(
    query(collection(db, workoutsPath(uid)), where("date", "==", date))
  );
  const list: Workout[] = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Workout, "id">) })
  );
  const rank = (w: Workout) =>
    w.slot === "morning-pt" ? 0 : w.slot === "strength" ? 1 : 2;
  return list.sort((a, b) => rank(a) - rank(b));
}

export async function listWorkouts(
  uid: string,
  opts: { limit?: number; extraConstraints?: QueryConstraint[] } = {}
): Promise<Workout[]> {
  const run = async () => {
    const constraints: QueryConstraint[] = [
      orderBy("date", "desc"),
      ...(opts.extraConstraints ?? []),
    ];
    if (opts.limit) constraints.push(limit(opts.limit));
    const snap = await getDocs(query(collection(db, workoutsPath(uid)), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, "id">) }));
  };
  // Custom constraints can't be represented in a cache key, so they bypass it.
  if (opts.extraConstraints?.length) return run();
  return cachedRead(cacheKey.workoutList(uid, opts.limit ?? 0), run);
}

export async function createWorkout(
  uid: string,
  data: Omit<Workout, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, workoutsPath(uid)), {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  invalidate(cacheKey.workouts(uid));
  return ref.id;
}

export async function saveWorkout(
  uid: string,
  id: string,
  data: Partial<Workout>
): Promise<void> {
  await setDoc(
    doc(db, workoutsPath(uid), id),
    { ...data, updatedAt: Date.now() },
    { merge: true }
  );
  invalidate(cacheKey.workouts(uid));
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, workoutsPath(uid), id));
  invalidate(cacheKey.workouts(uid));
}

// ---------- Exercise history (cross-workout) ----------

export interface ExerciseHistoryEntry {
  workoutId: string;
  date: string;
  workoutTitle: string;
  actualReps?: number;
  actualWeight?: number;
  setType: string;
  userNotes?: string;
}

export async function getExerciseHistory(
  uid: string,
  exerciseId: string,
  max = 10
): Promise<ExerciseHistoryEntry[]> {
  // Fetch last ~30 workouts, then filter sets for this exercise in-memory.
  // Good enough for a single-user app; Firestore subcollection indexing on sets
  // would be a premature optimization for this scale.
  const workouts = await listWorkouts(uid, { limit: 60 });
  const out: ExerciseHistoryEntry[] = [];
  for (const w of workouts) {
    for (const s of w.plannedSets ?? []) {
      if (s.exerciseId === exerciseId && s.completedAt) {
        out.push({
          workoutId: w.id,
          date: w.date,
          workoutTitle: w.title,
          actualReps: s.actualReps,
          actualWeight: s.actualWeight,
          setType: s.setType,
          userNotes: s.userNotes,
        });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

// ---------- User settings ----------

/**
 * Weekly goals live in a single settings doc rather than per-workout fields —
 * one read, one write, and no migration for existing users (a missing doc just
 * falls back to the defaults).
 */
export async function getWeeklyGoals(uid: string): Promise<WeeklyGoals> {
  try {
    const snap = await getDoc(doc(db, `${userRoot(uid)}/settings/weeklyGoals`));
    return normalizeGoals(snap.exists() ? snap.data() : null);
  } catch {
    return normalizeGoals(null);
  }
}

export async function saveWeeklyGoals(uid: string, goals: WeeklyGoals): Promise<void> {
  await setDoc(doc(db, `${userRoot(uid)}/settings/weeklyGoals`), {
    ...normalizeGoals(goals),
    updatedAt: Date.now(),
  });
}


// ---------- Supplements ----------

/**
 * A supplement the user takes. Definitions live in one settings doc; whether
 * you took it on a given day lives in a per-day log doc.
 *
 * Splitting it that way means renaming an item doesn't rewrite history, and a
 * day's log is a single small read — which matters because Today reads it on
 * every open.
 */
export interface SupplementItem {
  id: string;
  name: string;
  /** Display order, low to high. */
  order: number;
}

export async function getSupplements(uid: string): Promise<SupplementItem[]> {
  try {
    const snap = await getDoc(doc(db, `${userRoot(uid)}/settings/supplements`));
    if (!snap.exists()) return [];
    const raw = (snap.data()?.items ?? []) as SupplementItem[];
    return [...raw].sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export async function saveSupplements(uid: string, items: SupplementItem[]): Promise<void> {
  await setDoc(doc(db, `${userRoot(uid)}/settings/supplements`), {
    items: items.map((it, i) => ({ ...it, order: i })),
    updatedAt: Date.now(),
  });
}

/** Ids taken on `date` (YYYY-MM-DD). Missing doc = nothing taken yet. */
export async function getSupplementLog(uid: string, date: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, `${userRoot(uid)}/supplementLogs/${date}`));
    return snap.exists() ? ((snap.data()?.taken ?? []) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveSupplementLog(
  uid: string,
  date: string,
  taken: string[]
): Promise<void> {
  await setDoc(doc(db, `${userRoot(uid)}/supplementLogs/${date}`), {
    taken,
    updatedAt: Date.now(),
  });
}

/**
 * Logs for a date range, newest first — drives the streak on Today.
 * Document ids are the dates, so this is an id-range query with no index.
 */
export async function listSupplementLogs(
  uid: string,
  start: string,
  end: string
): Promise<Record<string, string[]>> {
  try {
    const snap = await getDocs(
      query(
        collection(db, `${userRoot(uid)}/supplementLogs`),
        where(documentId(), ">=", start),
        where(documentId(), "<=", end)
      )
    );
    const out: Record<string, string[]> = {};
    for (const d of snap.docs) out[d.id] = (d.data()?.taken ?? []) as string[];
    return out;
  } catch {
    return {};
  }
}

// ---------- AMRAP scores ----------

export interface AmrapResult {
  workoutId: string;
  date: string;
  rounds: number;
  extraReps?: number;
  capMinutes?: number;
}

/**
 * Past scores for one AMRAP, newest first. Matched on `fromTemplateId` so the
 * same benchmark tracks across every time it's been run, and filtered to
 * completed sessions that actually recorded a score.
 *
 * Scanning recent workouts in-memory (rather than a composite-indexed query)
 * keeps this a single read and avoids shipping another Firestore index for a
 * single-user app.
 */
export async function getAmrapHistory(
  uid: string,
  templateId: string,
  max = 20
): Promise<AmrapResult[]> {
  const workouts = await listWorkouts(uid, { limit: 200 });
  const out: AmrapResult[] = [];
  for (const w of workouts) {
    if (w.fromTemplateId !== templateId) continue;
    if (w.status !== "completed") continue;
    if (typeof w.roundsCompleted !== "number") continue;
    out.push({
      workoutId: w.id,
      date: w.date,
      rounds: w.roundsCompleted,
      extraReps: w.extraReps,
      capMinutes: w.capMinutes,
    });
    if (out.length >= max) break;
  }
  return out;
}

// ---------- Workout Templates ----------

export async function listTemplates(uid: string): Promise<WorkoutTemplate[]> {
  return cachedRead(cacheKey.templates(uid), async () => {
    const snap = await getDocs(
      query(collection(db, templatesPath(uid)), orderBy("name"))
    );
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<WorkoutTemplate, "id">) })
    );
  });
}

export async function getTemplate(
  uid: string,
  id: string
): Promise<WorkoutTemplate | null> {
  const snap = await getDoc(doc(db, templatesPath(uid), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<WorkoutTemplate, "id">) };
}

export async function createTemplate(
  uid: string,
  data: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, templatesPath(uid)), {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  invalidate(cacheKey.templates(uid));
  return ref.id;
}

export async function saveTemplate(
  uid: string,
  id: string,
  patch: Partial<WorkoutTemplate>
): Promise<void> {
  await setDoc(
    doc(db, templatesPath(uid), id),
    { ...patch, updatedAt: Date.now() },
    { merge: true }
  );
  invalidate(cacheKey.templates(uid));
}

export async function deleteTemplate(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, templatesPath(uid), id));
  invalidate(cacheKey.templates(uid));
}

/**
 * Materialize a template into a live Workout for today. Clones each set with
 * a fresh id, clears completion state, and sets status=in_progress with
 * startedAt=now. Returns the new workout id. Navigate to `/workout/:id` to
 * run it.
 *
 * We mint a fresh UUID for each set so subsequent in-workout edits (toggle
 * done, patch reps) don't write into the template doc.
 */
export async function startWorkoutFromTemplate(
  uid: string,
  template: WorkoutTemplate,
  opts: { slot?: Workout["slot"]; date?: string } = {}
): Promise<string> {
  const freshSets: PlannedSet[] = template.plannedSets.map((s, i) => ({
    ...s,
    id: crypto.randomUUID(),
    order: i + 1,
    // Strip any stale execution state that may have leaked in
    completedAt: null,
    actualReps: undefined,
    actualWeight: undefined,
    userNotes: undefined,
  }));
  // Default slot: PT Only → morning-pt, Full → strength. Callers can override
  // (e.g. running a PT template as a second session later in the day).
  const defaultSlot: Workout["slot"] =
    template.category === "PT Only" ? "morning-pt" : "strength";
  const slot = opts.slot ?? defaultSlot;
  // Create as "planned" — the user hasn't pressed Start yet. Today's FocusPill
  // shows "Ready to go" for planned docs; tapping Start flips to in_progress.
  // `date` lets the week planner schedule this for a future day instead.
  const newId = await createWorkout(uid, {
    date: opts.date ?? todayStr(),
    slot,
    title: template.name,
    focus: template.focus,
    status: "planned",
    plannedSets: freshSets,
    notes: template.notes,
    category: template.category,
    fromTemplateId: template.id,
    format: template.format,
    capMinutes: template.capMinutes,
  });
  return newId;
}

/**
 * All workouts whose `date` falls within the Mon-Sun range [start, end].
 * Used by the Home page to compute weekly progress against WEEKLY_GOALS.
 */
export async function listWorkoutsInRange(
  uid: string,
  start: string,
  end: string
): Promise<Workout[]> {
  return cachedRead(cacheKey.workoutRange(uid, start, end), async () => {
    const snap = await getDocs(
      query(
        collection(db, workoutsPath(uid)),
        where("date", ">=", start),
        where("date", "<=", end)
      )
    );
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Workout, "id">) })
    );
  });
}

// Re-export for convenience
export { serverTimestamp };
