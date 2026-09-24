/**
 * Firestore helpers. Data is scoped per-user under /users/{uid}/{collection}.
 * Security rules (firestore.rules) enforce that users can only touch their own subtree.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromCache,
  getDocFromServer,
  getDocsFromCache,
  arrayRemove,
  arrayUnion,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  documentId,
  serverTimestamp,
  type DocumentReference,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { app, db } from "./firebase";
import { cacheKey, cachedRead, invalidate, type LoadNote, type Source } from "./dbCache";
import type { Exercise, PlannedSet, Workout, WorkoutTemplate } from "./types";
import { todayStr } from "./dates";
import { normalizeGoals, type WeeklyGoals } from "./weeklyGoals";
import { slotOrder } from "./slots";
import type { TrainingSignal } from "./trainingSignals";

// Path helpers
const userRoot = (uid: string) => `users/${uid}`;
const exercisesPath = (uid: string) => `${userRoot(uid)}/exercises`;
const workoutsPath = (uid: string) => `${userRoot(uid)}/workouts`;
const templatesPath = (uid: string) => `${userRoot(uid)}/templates`;

/**
 * Read from the device cache or the server. dbCache asks the device first and
 * the server in the background — see dbCache.ts. Offline, Firestore answers a
 * server read from the phone; the note tells dbCache not to trust it as fresh.
 */
async function readDocs(q: Query, from: Source, note?: LoadNote) {
  if (from === "cache") return getDocsFromCache(q);
  const snap = await getDocs(q);
  if (note && snap.metadata.fromCache) note.fromCache = true;
  return snap;
}
async function readDoc(r: DocumentReference, from: Source, note?: LoadNote) {
  if (from === "cache") return getDocFromCache(r);
  const snap = await getDoc(r);
  if (note && snap.metadata.fromCache) note.fromCache = true;
  return snap;
}

/** fresh: the server's answer, for code that writes or decides from what it reads. */
type ReadOpts = { fresh?: boolean };

/**
 * Run a write and drop the cached reads it affects — once as it's issued, so
 * the next read goes to the device cache (which already holds the write, even
 * offline), and again when the server confirms it.
 */
async function write<T>(prefix: string, op: Promise<T>): Promise<T> {
  invalidate(prefix);
  try {
    return await op;
  } finally {
    invalidate(prefix);
  }
}

// ---------- Exercises ----------

export async function listExercises(uid: string, opts: ReadOpts = {}): Promise<Exercise[]> {
  return cachedRead(cacheKey.exercises(uid), async (from, note) => {
    const snap = await readDocs(
      query(collection(db, exercisesPath(uid)), orderBy("name")),
      from,
      note
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, "id">) }));
  }, opts);
}

export async function createExercise(
  uid: string,
  data: Omit<Exercise, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await write(
    cacheKey.exercises(uid),
    addDoc(collection(db, exercisesPath(uid)), {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
  return ref.id;
}

export async function updateExercise(
  uid: string,
  id: string,
  patch: Partial<Exercise>
): Promise<void> {
  await write(
    cacheKey.exercises(uid),
    updateDoc(doc(db, exercisesPath(uid), id), {
      ...patch,
      updatedAt: Date.now(),
    })
  );
}

export async function deleteExercise(uid: string, id: string): Promise<void> {
  await write(cacheKey.exercises(uid), deleteDoc(doc(db, exercisesPath(uid), id)));
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
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const ref = storageRef(getStorage(app), path);
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
  const { getStorage, ref: storageRef, deleteObject } = await import("firebase/storage");
  const storage = getStorage(app);
  for (const ext of ["gif", "png", "jpg", "webp"]) {
    try {
      await deleteObject(storageRef(storage, `users/${uid}/exercise-gifs/${exerciseId}.${ext}`));
    } catch {
      // ignore missing files
    }
  }
  await updateExercise(uid, exerciseId, { gifUrl: undefined });
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
 * Ordering: stretch, then shoulder PT, then the workout, then any legacy doc with no
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
    slotOrder(w.slot);
  return list.sort((a, b) => rank(a) - rank(b));
}

export async function listWorkouts(
  uid: string,
  opts: { limit?: number; extraConstraints?: QueryConstraint[] } & ReadOpts = {}
): Promise<Workout[]> {
  const run = async (from: Source = "server", note?: LoadNote) => {
    const constraints: QueryConstraint[] = [
      orderBy("date", "desc"),
      ...(opts.extraConstraints ?? []),
    ];
    if (opts.limit) constraints.push(limit(opts.limit));
    const snap = await readDocs(query(collection(db, workoutsPath(uid)), ...constraints), from, note);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, "id">) }));
  };
  // Custom constraints can't be represented in a cache key, so they bypass it.
  if (opts.extraConstraints?.length) return run();
  return cachedRead(cacheKey.workoutList(uid, opts.limit ?? 0), run, { fresh: opts.fresh });
}

export async function createWorkout(
  uid: string,
  data: Omit<Workout, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await write(
    cacheKey.workouts(uid),
    addDoc(collection(db, workoutsPath(uid)), {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
  return ref.id;
}

export async function saveWorkout(
  uid: string,
  id: string,
  data: Partial<Workout>
): Promise<void> {
  await write(
    cacheKey.workouts(uid),
    setDoc(doc(db, workoutsPath(uid), id), { ...data, updatedAt: Date.now() }, { merge: true })
  );
}

/**
 * Delete a workout only if it's still in the state this screen showed.
 *
 * A screen painted from the phone's copy can show a session as planned that
 * was started or finished on another device since. Removing it from there
 * would delete a finished workout — a historical record. So check the server
 * first; if it has moved on, leave it alone and return false. Offline the
 * check falls back to the phone's copy, which is what the screen showed.
 */
export async function deleteWorkoutIfUnchanged(
  uid: string,
  id: string,
  expectedStatus: Workout["status"]
): Promise<boolean> {
  const ref = doc(db, workoutsPath(uid), id);
  const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
  if (!snap.exists()) return true; // already gone
  if ((snap.data() as Workout).status !== expectedStatus) {
    invalidate(cacheKey.workouts(uid)); // the screen is behind; make its next read fresh
    return false;
  }
  await deleteWorkout(uid, id);
  return true;
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  await write(cacheKey.workouts(uid), deleteDoc(doc(db, workoutsPath(uid), id)));
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
    return await cachedRead(
      cacheKey.goals(uid),
      async (from, note) => {
        const snap = await readDoc(doc(db, `${userRoot(uid)}/settings/weeklyGoals`), from, note);
        return normalizeGoals(snap.exists() ? snap.data() : null);
      },
      { trustEmpty: true }
    );
  } catch {
    return normalizeGoals(null);
  }
}

/**
 * Set one goal. Merges that field only, so a screen that painted slightly old
 * goals can't write the others back over a newer change.
 */
export async function saveWeeklyGoal(
  uid: string,
  kind: keyof WeeklyGoals,
  value: number
): Promise<void> {
  await write(
    cacheKey.goals(uid),
    setDoc(
      doc(db, `${userRoot(uid)}/settings/weeklyGoals`),
      { [kind]: normalizeGoals({ [kind]: value })[kind], updatedAt: Date.now() },
      { merge: true }
    )
  );
}

export async function saveWeeklyGoals(uid: string, goals: WeeklyGoals): Promise<void> {
  await write(
    cacheKey.goals(uid),
    setDoc(doc(db, `${userRoot(uid)}/settings/weeklyGoals`), {
      ...normalizeGoals(goals),
      updatedAt: Date.now(),
    })
  );
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
    return await cachedRead(
      cacheKey.supplements(uid),
      async (from, note) => {
        const snap = await readDoc(doc(db, `${userRoot(uid)}/settings/supplements`), from, note);
        if (!snap.exists()) return [];
        const raw = (snap.data()?.items ?? []) as SupplementItem[];
        return [...raw].sort((a, b) => a.order - b.order);
      },
      { trustEmpty: true }
    );
  } catch {
    return [];
  }
}

export async function saveSupplements(uid: string, items: SupplementItem[]): Promise<void> {
  await write(
    cacheKey.supplements(uid),
    setDoc(doc(db, `${userRoot(uid)}/settings/supplements`), {
      items: items.map((it, i) => ({ ...it, order: i })),
      updatedAt: Date.now(),
    })
  );
}

/** Ids taken on `date` (YYYY-MM-DD). Missing doc = nothing taken yet. */
export async function getSupplementLog(uid: string, date: string): Promise<string[]> {
  try {
    return await cachedRead(
      cacheKey.supplementLog(uid, date),
      async (from, note) => {
        const snap = await readDoc(doc(db, `${userRoot(uid)}/supplementLogs/${date}`), from, note);
        return snap.exists() ? ((snap.data()?.taken ?? []) as string[]) : [];
      },
      { trustEmpty: true }
    );
  } catch {
    return [];
  }
}

/**
 * Tick or untick one supplement for a day. The server merges it, so a tap on a
 * screen that painted an older copy of the day can't erase ticks made
 * elsewhere — rewriting the whole list could.
 */
export async function setSupplementTaken(
  uid: string,
  date: string,
  id: string,
  taken: boolean
): Promise<void> {
  await write(
    cacheKey.supplements(uid),
    setDoc(
      doc(db, `${userRoot(uid)}/supplementLogs/${date}`),
      { taken: taken ? arrayUnion(id) : arrayRemove(id), updatedAt: Date.now() },
      { merge: true }
    )
  );
}

export async function saveSupplementLog(
  uid: string,
  date: string,
  taken: string[]
): Promise<void> {
  // Log keys all start with supplements:<uid>, so the day and the range both go.
  await write(
    cacheKey.supplements(uid),
    setDoc(doc(db, `${userRoot(uid)}/supplementLogs/${date}`), {
      taken,
      updatedAt: Date.now(),
    })
  );
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
    return await cachedRead(cacheKey.supplementLogs(uid, start, end), async (from, note) => {
      const snap = await readDocs(
        query(
          collection(db, `${userRoot(uid)}/supplementLogs`),
          where(documentId(), ">=", start),
          where(documentId(), "<=", end)
        ),
        from,
        note
      );
      const out: Record<string, string[]> = {};
      for (const d of snap.docs) out[d.id] = (d.data()?.taken ?? []) as string[];
      return out;
    });
  } catch {
    return {};
  }
}

// ---------- Training signals ----------

/**
 * The log of sessions you threw away.
 *
 * Kept as one capped array in a single document rather than a collection: it's
 * read on every plan and written rarely, so one read beats N, and nothing here
 * is worth paginating. Oldest entries fall off the front — a rejection from
 * four months ago shouldn't still be shaping next week.
 */
const MAX_SIGNALS = 200;

const signalsDoc = (uid: string) => doc(db, `${userRoot(uid)}/meta/signals`);

export async function getTrainingSignals(uid: string, opts: ReadOpts = {}): Promise<TrainingSignal[]> {
  return cachedRead(
    cacheKey.signals(uid),
    async (from, note) => {
      const snap = await readDoc(signalsDoc(uid), from, note);
      const raw = snap.exists() ? (snap.data().entries as unknown) : null;
      return Array.isArray(raw) ? (raw as TrainingSignal[]) : [];
    },
    { trustEmpty: true, ...opts }
  );
}

/** Append one signal. Safe to call from a delete handler — never throws. */
export async function recordTrainingSignal(
  uid: string,
  signal: TrainingSignal
): Promise<void> {
  try {
    // Read-modify-write: from the server's copy, or a stale phone copy would
    // erase signals recorded elsewhere.
    const existing = await getTrainingSignals(uid, { fresh: true });
    const entries = [...existing, signal].slice(-MAX_SIGNALS);
    await write(cacheKey.signals(uid), setDoc(signalsDoc(uid), { entries, updatedAt: Date.now() }));
  } catch (e) {
    // Losing a preference signal must never break the delete the user asked
    // for. Worst case the planner offers that routine again.
    console.error("[db] recordTrainingSignal failed:", e);
  }
}

/**
 * Forget every opinion recorded about one routine.
 *
 * The escape hatch for the learning. A planner that quietly stops offering
 * something, with no way to see it or undo it, is worse than one that doesn't
 * learn at all — so the Plan page lists what it has stopped offering and this
 * is the button behind it.
 */
export async function clearTrainingSignals(
  uid: string,
  templateName: string
): Promise<void> {
  const existing = await getTrainingSignals(uid, { fresh: true });
  const entries = existing.filter((s) => s.templateName !== templateName);
  await write(cacheKey.signals(uid), setDoc(signalsDoc(uid), { entries, updatedAt: Date.now() }));
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
  // Fresh: the runner doesn't subscribe to refreshes, so a partial list from
  // the phone would stick for the whole session.
  const workouts = await listWorkouts(uid, { limit: 200, fresh: true });
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
  return cachedRead(cacheKey.templates(uid), async (from, note) => {
    const snap = await readDocs(
      query(collection(db, templatesPath(uid)), orderBy("name")),
      from,
      note
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
  const ref = await write(
    cacheKey.templates(uid),
    addDoc(collection(db, templatesPath(uid)), {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
  return ref.id;
}

/**
 * A template patch. `null` on an optional field REMOVES it.
 *
 * That distinction matters because the Firestore instance runs with
 * `ignoreUndefinedProperties: true`, so `{ estimatedMinutes: undefined }` is
 * dropped from the write entirely rather than clearing anything — the field
 * would survive every attempt to unset it.
 */
export type TemplatePatch = Partial<WorkoutTemplate> & {
  estimatedMinutes?: number | null;
  capMinutes?: number | null;
};

export async function saveTemplate(
  uid: string,
  id: string,
  patch: TemplatePatch
): Promise<void> {
  const body: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [k, v] of Object.entries(patch)) {
    body[k] = v === null ? deleteField() : v;
  }
  await write(cacheKey.templates(uid), setDoc(doc(db, templatesPath(uid), id), body, { merge: true }));
}

export async function deleteTemplate(uid: string, id: string): Promise<void> {
  await write(cacheKey.templates(uid), deleteDoc(doc(db, templatesPath(uid), id)));
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
  // A guided stretch flow IS the five-minute opener, so it defaults to the
  // stretch slot. An AMRAP is conditioning and belongs in the main slot even
  // when filed under PT — "AMRAP · Recovery 25" is a recovery session, not a
  // morning routine. Everything else PT-shaped is the shoulder work.
  const defaultSlot: Workout["slot"] =
    template.format === "flow"
      ? "morning-stretch"
      : template.category === "PT Only" && template.format !== "amrap"
      ? "morning-pt"
      : "strength";
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
    estimatedMinutes: template.estimatedMinutes,
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
  end: string,
  opts: ReadOpts = {}
): Promise<Workout[]> {
  return cachedRead(cacheKey.workoutRange(uid, start, end), async (from, note) => {
    const snap = await readDocs(
      query(
        collection(db, workoutsPath(uid)),
        where("date", ">=", start),
        where("date", "<=", end)
      ),
      from,
      note
    );
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Workout, "id">) })
    );
  }, opts);
}

// Re-export for convenience
export { serverTimestamp };
