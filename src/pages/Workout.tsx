import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useBack } from "../hooks/useBack";
import { useScrollRestoration } from "../hooks/useScrollRestoration";
import { useAuth } from "../hooks/useAuth";
import {
  deleteWorkout,
  getAmrapHistory,
  getWorkout,
  listExercises,
  recordTrainingSignal,
  saveWorkout,
  type AmrapResult,
} from "../lib/db";
import { signalFor } from "../lib/trainingSignals";
import { Button, Card, Overlay, PageSkeleton, ProgressBar, Sheet, Tag } from "../components/ui";
import ExerciseGif from "../components/ExerciseGif";
import SwipeBack from "../components/SwipeBack";
import RestTimer from "../components/RestTimer";
import IntervalTimer from "../components/IntervalTimer";
import ExercisePicker from "../components/ExercisePicker";
import ManagePlanSheet from "../components/ManagePlanSheet";
import SingleSetTimer from "../components/SingleSetTimer";
import SwipeToDelete from "../components/SwipeToDelete";
import AmrapRunner from "../components/AmrapRunner";
import FlowRunner from "../components/FlowRunner";
import { defaultEstimatedMinutes, isTimeBasedExercise } from "../lib/duration";
import { demoUrlsForSets, prefetchInBackground } from "../lib/offlineDemos";
import type { Exercise, PlannedSet, Workout } from "../lib/types";
import { fmtDuration } from "../lib/dates";
import { estimatePlannedMinutes } from "../lib/timeEstimate";
import {
  buildBlocks,
  interleaveSupersetSets,
  linkBlocksAsSuperset,
  renumber,
  type Block,
} from "../lib/blocks";

export default function WorkoutPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const [searchParams] = useSearchParams();
  // Where "back" goes. Set by whoever linked here; Today is the sane default.
  const backTo = searchParams.get("from") || "/";
  // Prefer unwinding real history; `backTo` only covers a cold deep link.
  const back = useBack();
  const goBack = () => back(backTo);
  // This route lives outside AppShell, so it wires up its own restoration.
  useScrollRestoration();
  const { user } = useAuth();
  const nav = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [restSec, setRestSec] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  /** Per-exercise ⋯ menu — the quick alternative to the full Manage sheet. */
  const [blockMenu, setBlockMenu] = useState<{
    exerciseId: string;
    name: string;
    index: number;
    /** The exercise after this one, when it can be paired with it. */
    nextName?: string;
  } | null>(null);
  /** When set, the exercise picker swaps this exercise instead of adding one. */
  const [swapFor, setSwapFor] = useState<string | null>(null);
  /** Block index a new exercise should land at, or null when the picker is shut. */
  const [insertAt, setInsertAt] = useState<number | null>(null);
  /** Dismissed for this visit — asking again on every render would be a trap. */
  const [finishModeAsked, setFinishModeAsked] = useState(false);
  /** The last value carried to later sets, so it can be nudged or undone. */
  const [carry, setCarry] = useState<{
    /** The cell being typed into, so retyping it doesn't re-snapshot. */
    targetId: string;
    exerciseId: string;
    field: "actualWeight" | "actualReps";
    value: number;
    ids: Set<string>;
    before: Map<string, number | null>;
  } | null>(null);
  const [singleTimerSet, setSingleTimerSet] = useState<PlannedSet | null>(null);
  const [intervalSetup, setIntervalSetup] = useState(false);
  const [intervalRunning, setIntervalRunning] = useState<{
    work: number;
    rest: number;
  } | null>(null);
  const [amrapHistory, setAmrapHistory] = useState<AmrapResult[]>([]);
  // "native" = the runner this workout's format calls for; "list" = the plain
  // set table. Session-local on purpose — switching views is a look, not a
  // preference worth persisting.
  const [viewMode, setViewMode] = useState<"native" | "list">("native");

  useEffect(() => {
    if (!user || !workoutId) return;
    let alive = true;
    (async () => {
      const [w, list] = await Promise.all([
        getWorkout(user.uid, workoutId),
        listExercises(user.uid),
      ]);
      if (!alive) return;
      setWorkout(w);
      setExercises(list);
      // Warm the demo cache for the whole workout while we (probably) still
      // have signal — scrolling to exercise 8 in a gym basement shouldn't be
      // the first time its demo gets fetched.
      if (w) {
        const gifs = new Map(list.map((e) => [e.id, e.gifUrl]));
        prefetchInBackground(demoUrlsForSets(w.plannedSets ?? [], gifs));
      }
      // AMRAPs are scored against past attempts, so pull previous results.
      if (w?.format === "amrap" && w.fromTemplateId) {
        const hist = await getAmrapHistory(user.uid, w.fromTemplateId);
        if (alive) setAmrapHistory(hist);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, workoutId]);

  const gifByExerciseId = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const ex of exercises) m.set(ex.id, ex.gifUrl);
    return m;
  }, [exercises]);

  const [now, setNow] = useState(Date.now());
  /**
   * Ask how to finish, once, on a standard session that hasn't been asked.
   * AMRAPs and flows already run to their own clock, so the question would be
   * meaningless there.
   */
  const needsFinishMode =
    !!workout &&
    !workout.finishMode &&
    !finishModeAsked &&
    workout.format !== "amrap" &&
    workout.format !== "flow";

  /** Milliseconds left on a time-capped session, or null when it isn't one. */
  const timeLeftMs =
    workout?.finishMode === "time" && workout.timeCapMinutes
      ? workout.timeCapMinutes * 60_000 - (now - (workout.startedAt ?? now))
      : null;
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * Every entry path converges on this screen, so this is where "started" is
   * guaranteed. Some routes (Recommend's Start, deep links) skip the review
   * screen that stamps startedAt — without this, the session stays "planned"
   * and the elapsed clock sits at 0:00 for the whole workout.
   */
  useEffect(() => {
    if (!user || !workout || workout.status !== "planned") return;
    const startedAt = workout.startedAt ?? Date.now();
    setWorkout((w) => (w ? { ...w, status: "in_progress", startedAt } : w));
    saveWorkout(user.uid, workout.id, { status: "in_progress", startedAt }).catch((e) =>
      console.error("[Workout] could not mark started:", e)
    );
  }, [user, workout]);

  if (!workout) {
    return (
      <div className="min-h-full max-w-xl mx-auto p-6">
        <PageSkeleton rows={5} />
      </div>
    );
  }

  // Format picks the default runner; "View as list" drops to the plain set
  // table, which every format can fall back to because they all store their
  // work in plannedSets.
  const nativeView = viewMode === "native";

  if (workout.format === "amrap" && nativeView) {
    return (
      <SwipeBack onBack={goBack}>
        <AmrapRunner
          workout={workout}
          history={amrapHistory}
          gifByExerciseId={gifByExerciseId}
          onManage={() => setManageOpen(true)}
          onViewAsList={() => setViewMode("list")}
          onBack={goBack}
          onFinish={async (rounds, extra) => {
            if (!user) return;
            await saveWorkout(user.uid, workout.id, {
              status: "completed",
              completedAt: Date.now(),
              startedAt: workout.startedAt ?? Date.now(),
              roundsCompleted: rounds,
              extraReps: extra,
            });
            nav(`/history/${workout.id}`, { replace: true });
          }}
        />
        {manageOpen && (
          <ManagePlanSheet
            workout={workout}
            exercises={exercises}
            gifByExerciseId={gifByExerciseId}
            onChange={replaceSets}
            onClose={() => setManageOpen(false)}
          />
        )}
      </SwipeBack>
    );
  }

  if (workout.format === "flow" && nativeView) {
    return (
      <SwipeBack onBack={goBack}>
        <FlowRunner
          workout={workout}
          gifByExerciseId={gifByExerciseId}
          onComplete={(s) =>
            void patchSet(s.id, {
              completedAt: Date.now(),
              actualReps: s.actualReps ?? s.targetReps,
              actualWeight: s.actualWeight ?? s.targetWeight,
            })
          }
          onFinish={() => void finishWorkout()}
          onManage={() => setManageOpen(true)}
          onViewAsList={() => setViewMode("list")}
          onBack={goBack}
        />
        {manageOpen && (
          <ManagePlanSheet
            workout={workout}
            exercises={exercises}
            gifByExerciseId={gifByExerciseId}
            onChange={replaceSets}
            onClose={() => setManageOpen(false)}
          />
        )}
      </SwipeBack>
    );
  }

  const blocks = buildBlocks(workout);
  const completedCount = workout.plannedSets.filter((s) => s.completedAt).length;
  const totalCount = workout.plannedSets.length;

  /**
   * Log a value on one set, and carry it to the rest of that exercise.
   *
   * You almost never do 135, then 140, then 130 — you pick a weight and work
   * it, so typing it once per set was pure retyping. Changing the load or the
   * reps now fills the remaining *unlogged* sets of the same exercise with the
   * same number. Sets you've already ticked are history and are left alone.
   *
   * It's a default, not a decision: the bar that appears underneath adjusts it
   * up or down across those sets, or puts it back.
   */
  async function patchSetAndCarry(id: string, patch: Partial<PlannedSet>) {
    if (!user || !workout) return;
    const sets = workout.plannedSets;
    const target = sets.find((s) => s.id === id);
    const field: "actualWeight" | "actualReps" | null =
      "actualWeight" in patch ? "actualWeight" : "actualReps" in patch ? "actualReps" : null;
    if (!target || !field) return patchSet(id, patch);

    const value = patch[field];
    if (typeof value !== "number") return patchSet(id, patch);

    // Sets after this one in the SAME BLOCK. Scoping by exerciseId alone
    // reached across the whole workout, so typing a weight into the first of
    // two separate Bench Press blocks silently rewrote the second one too.
    // A block is a contiguous run, which is exactly what buildBlocks groups.
    const from = sets.findIndex((s) => s.id === id);
    const followers: PlannedSet[] = [];
    for (let i = from + 1; i < sets.length; i++) {
      const s = sets[i];
      if (s.exerciseId !== target.exerciseId) break;
      if (s.supersetGroupId !== target.supersetGroupId) break;
      // Timed work progresses on duration, and a logged set is history.
      if (s.completedAt || s.workSeconds != null) continue;
      followers.push(s);
    }

    // Reuse the existing snapshot while the same cell is being retyped.
    // Rebuilding it per keystroke meant "before" captured the half-typed
    // number — type 165 over 155 and Undo restored 16.
    const sameEdit =
      carry !== null && carry.targetId === id && carry.field === field;
    const before = sameEdit ? new Map(carry.before) : new Map<string, number | null>();
    for (const s of followers) {
      if (!before.has(s.id)) before.set(s.id, s[field] ?? null);
    }

    const ids = new Set(followers.map((s) => s.id));
    const updated = sets.map((s) =>
      s.id === id ? { ...s, ...patch } : ids.has(s.id) ? { ...s, [field]: value } : s
    );
    setCarry(
      followers.length
        ? { targetId: id, exerciseId: target.exerciseId, field, value, ids, before }
        : null
    );
    await commitSets(updated);
  }

  /**
   * Sets a carry may still write to.
   *
   * Re-derived at apply time, never trusted from the snapshot: a set ticked
   * off after the carry was captured is logged work, and the ± and Undo
   * buttons were rewriting it. Undo was worse than ±, restoring a value the
   * set never had — or clearing it outright.
   */
  function liveCarryIds(): Set<string> {
    if (!workout || !carry) return new Set();
    return new Set(
      workout.plannedSets
        .filter((s) => carry.ids.has(s.id) && !s.completedAt)
        .map((s) => s.id)
    );
  }

  const liveCarryCount = carry ? liveCarryIds().size : 0;

  /** Nudge the carried value across the sets it still applies to. */
  async function adjustCarry(delta: number) {
    if (!workout || !carry) return;
    const live = liveCarryIds();
    const value = Math.max(0, carry.value + delta);
    const updated = workout.plannedSets.map((s) =>
      live.has(s.id) ? { ...s, [carry.field]: value } : s
    );
    setCarry({ ...carry, value, ids: live });
    await commitSets(updated);
  }

  /** Put the still-unlogged followers back to whatever they said before. */
  async function undoCarry() {
    if (!workout || !carry) return;
    const live = liveCarryIds();
    const updated = workout.plannedSets.map((s) =>
      live.has(s.id) ? { ...s, [carry.field]: carry.before.get(s.id) ?? undefined } : s
    );
    setCarry(null);
    await commitSets(updated);
  }

  async function commitSets(updated: PlannedSet[]) {
    if (!user || !workout) return;
    setWorkout({ ...workout, plannedSets: updated });
    setSaving(true);
    try {
      await saveWorkout(user.uid, workout.id, { plannedSets: updated });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Remove one set. Renumbers what's left so the chips stay 1, 2, 3 rather
   * than developing gaps.
   */
  /** Throw the whole session away — nothing logged is kept. */
  async function discardWorkout() {
    if (!user || !workout) return;
    if (
      !confirm(
        `Delete "${workout.title}"? Anything you've logged in it will be lost.`
      )
    ) {
      return;
    }
    if (workout.status === "planned") {
      await recordTrainingSignal(user.uid, signalFor(workout, "deleted"));
    }
    await deleteWorkout(user.uid, workout.id);
    goBack();
  }

  /**
   * Add an exercise at a chosen point in the live session.
   *
   * Editing used to mean opening the Manage sheet, which puts a modal between
   * you and the workout you're in the middle of. These do the two things you
   * actually need mid-session — put an exercise somewhere, pair two of them —
   * on the screen itself. Manage still exists for reordering and bulk work.
   */
  async function insertExercise(ex: Exercise, at: number) {
    if (!workout) return;
    const blocks = buildBlocks(workout);
    const setsOf = (b: (typeof blocks)[number]) =>
      b.kind === "exercise" ? b.sets : b.members.flatMap((m) => m.sets);
    const fresh: PlannedSet = {
      id: crypto.randomUUID(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      order: 0,
      targetReps: ex.defaultReps ?? 10,
      targetWeight: ex.defaultWeight,
      setType: ex.isPT ? "PT/Rehab" : "Working",
      restSeconds: 60,
      workSeconds: isTimeBasedExercise(ex.name)
        ? Math.round((defaultEstimatedMinutes(ex.name) * 60) / 1)
        : undefined,
      notes: "",
      completedAt: null,
    };
    const before = blocks.slice(0, at).flatMap(setsOf);
    const after = blocks.slice(at).flatMap(setsOf);
    setInsertAt(null);
    await commitSets(
      [...before, fresh, ...after].map((x, i) => ({ ...x, order: i + 1 }))
    );
  }

  /** Pair an exercise with the one after it, in one tap. */
  async function supersetWithNext(blockIndex: number) {
    if (!workout) return;
    const next = linkBlocksAsSuperset(workout, blockIndex, blockIndex + 1);
    if (next === workout.plannedSets) return;
    await commitSets(next);
  }

  /** Record how this session should end. */
  async function chooseFinishMode(mode: "sets" | "time", minutes?: number) {
    if (!user || !workout) return;
    const patch =
      mode === "time"
        ? { finishMode: mode, timeCapMinutes: minutes }
        : { finishMode: mode };
    setWorkout({ ...workout, ...patch });
    setFinishModeAsked(true);
    await saveWorkout(user.uid, workout.id, patch);
  }

  async function deleteSet(id: string) {
    if (!workout) return;
    const updated = workout.plannedSets
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setCarry(null);
    await commitSets(updated);
  }

  async function patchSet(id: string, patch: Partial<PlannedSet>) {
    if (!user || !workout) return;
    const updated = workout.plannedSets.map((s) => (s.id === id ? { ...s, ...patch } : s));
    const newW = { ...workout, plannedSets: updated };
    setWorkout(newW);
    setSaving(true);
    try {
      await saveWorkout(user.uid, workout.id, { plannedSets: updated });
    } finally {
      setSaving(false);
    }
  }

  async function toggleSetDone(set: PlannedSet) {
    if (set.completedAt) {
      // Un-complete (undo accidental check)
      await patchSet(set.id, { completedAt: undefined });
      return;
    }
    await patchSet(set.id, {
      completedAt: Date.now(),
      actualReps: set.actualReps ?? set.targetReps,
      actualWeight: set.actualWeight ?? set.targetWeight,
    });
    // No auto rest-timer — user opens it manually from header if they want one.
  }

  async function replaceSets(nextSets: PlannedSet[]) {
    if (!user || !workout) return;
    const newW = { ...workout, plannedSets: nextSets };
    setWorkout(newW);
    setSaving(true);
    try {
      await saveWorkout(user.uid, workout.id, { plannedSets: nextSets });
    } finally {
      setSaving(false);
    }
  }

  async function addSetToExercise(exerciseId: string) {
    if (!workout) return;
    const groupSets = workout.plannedSets.filter((s) => s.exerciseId === exerciseId);
    const last = groupSets[groupSets.length - 1];
    if (!last) return;
    const newSet: PlannedSet = {
      id: crypto.randomUUID(),
      exerciseId: last.exerciseId,
      exerciseName: last.exerciseName,
      // Position in the array decides sequence; renumber() below makes
      // `order` agree with it.
      order: 0,
      targetReps: last.targetReps,
      targetWeight: last.targetWeight,
      setType: last.setType,
      restSeconds: last.restSeconds,
      // Carry the duration: without it, adding a set to a rowing or treadmill
      // block turned the new one into a reps-and-weight set.
      workSeconds: last.workSeconds,
      estimatedMinutes:
        last.estimatedMinutes ?? defaultEstimatedMinutes(last.exerciseName),
      notes: "",
      completedAt: null,
    };
    const lastIdx = workout.plannedSets.findIndex((s) => s.id === last.id);
    const nextSets = [...workout.plannedSets];
    nextSets.splice(lastIdx + 1, 0, newSet);
    await replaceSets(renumber(nextSets));
  }

  /**
   * Swap an exercise mid-workout (machine taken, shoulder says no). Only the
   * unlogged sets move to the new exercise — anything already ticked is
   * history and stays attributed to what you actually did.
   */
  async function swapExercise(oldExerciseId: string, ex: Exercise) {
    if (!workout) return;
    const next = workout.plannedSets.map((s) =>
      s.exerciseId === oldExerciseId && !s.completedAt
        ? { ...s, exerciseId: ex.id, exerciseName: ex.name }
        : s
    );
    await replaceSets(next);
  }

  /** Drop an exercise's unlogged sets; sets already ticked stay in the log. */
  async function removeExercise(exerciseId: string) {
    if (!workout) return;
    await replaceSets(
      workout.plannedSets.filter((s) => s.exerciseId !== exerciseId || !!s.completedAt)
    );
  }

  async function addExerciseMid(ex: Exercise) {
    if (!workout) return;
    const maxOrder = Math.max(...workout.plannedSets.map((s) => s.order), 0);
    const newSet: PlannedSet = {
      id: crypto.randomUUID(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      order: maxOrder + 1,
      targetReps: ex.defaultReps ?? 10,
      targetWeight: ex.defaultWeight,
      setType: ex.isPT ? "PT/Rehab" : "Working",
      restSeconds: 60,
      estimatedMinutes: defaultEstimatedMinutes(ex.name),
      // Treadmill / rower / stair climber are logged as a duration, so seed
      // one rather than making the user convert the set by hand.
      workSeconds: isTimeBasedExercise(ex.name)
        ? defaultEstimatedMinutes(ex.name) * 60
        : undefined,
      notes: "",
      completedAt: null,
    };
    await replaceSets([...workout.plannedSets, newSet]);
    setPickerOpen(false);
  }

  async function finishWorkout() {
    if (!user || !workout) return;
    await saveWorkout(user.uid, workout.id, {
      status: "completed",
      completedAt: Date.now(),
    });
    nav(`/history/${workout.id}`, { replace: true });
  }

  return (
    <SwipeBack onBack={goBack}>
    <div className="min-h-full max-w-xl mx-auto flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-[color:var(--color-separator)] bg-[color:var(--color-bg)]/85 px-4 pb-2.5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            aria-label="Back"
            className="-ml-1 flex shrink-0 items-center text-[color:var(--color-accent)] active:opacity-60"
          >
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 1.5 2 9 9 16.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[16px] font-semibold tracking-[-0.01em]">
              {workout.title}
            </div>
            <div className="text-[12px] tnum text-[color:var(--color-muted)]">
              {completedCount} of {totalCount} sets
              {saving && <span className="opacity-70"> · saving…</span>}
            </div>
          </div>
          <div className="shrink-0 text-[16px] font-semibold tnum">
            {timeLeftMs != null ? (
              <span
                className={
                  timeLeftMs <= 0
                    ? "text-[color:var(--color-danger)]"
                    : timeLeftMs < 5 * 60_000
                    ? "text-[color:var(--color-warn)]"
                    : undefined
                }
              >
                {timeLeftMs <= 0 ? "time" : fmtDuration(timeLeftMs)}
              </span>
            ) : (
              fmtDuration(now - (workout.startedAt ?? now))
            )}
          </div>
        </div>

        <ProgressBar value={completedCount} max={totalCount} />

        {/* Session tools. Plain text actions — they're used occasionally, so
            they shouldn't compete with the set rows for attention. */}
        <div className="mt-2.5 flex items-center justify-between text-[14px] text-[color:var(--color-accent)]">
          <button onClick={() => setManageOpen(true)} className="active:opacity-60">
            Manage
          </button>
          {workout.format && workout.format !== "standard" ? (
            // Only shown when there's a runner to go back to.
            <button onClick={() => setViewMode("native")} className="active:opacity-60">
              {workout.format === "flow" ? "Guided view" : "Scored view"}
            </button>
          ) : (
            <button onClick={() => setRestSec(60)} className="active:opacity-60">
              Rest 60s
            </button>
          )}
          <button onClick={() => setIntervalSetup(true)} className="active:opacity-60">
            Play all timers
          </button>
        </div>
      </header>

      <div className="space-y-4 p-4 pb-36">
        {workout.notes && (
          <Card>
            <div className="text-[13px] text-[color:var(--color-muted)]">Note</div>
            <p className="mt-1 text-[15px] leading-snug">{workout.notes}</p>
          </Card>
        )}
        {blocks.map((b, i) => (
          <div
            key={b.kind === "exercise" ? `ex:${b.exerciseId}` : `ss:${b.supersetGroupId}`}
          >
            {/* Insert points, so an exercise can go where you want it without
                opening a sheet over the workout you're in the middle of. */}
            {i === 0 && <InsertPoint onClick={() => setInsertAt(0)} />}
            <BlockSection
              block={b}
              gifByExerciseId={gifByExerciseId}
              onPatch={patchSet}
              onCarry={patchSetAndCarry}
              onDelete={deleteSet}
              onToggle={toggleSetDone}
              onAddSetToExercise={addSetToExercise}
              onStartSetTimer={(s) => setSingleTimerSet(s)}
              onMenu={
                b.kind === "exercise"
                  ? () =>
                      setBlockMenu({
                        exerciseId: b.exerciseId,
                        name: b.exerciseName,
                        index: i,
                        nextName:
                          blocks[i + 1]?.kind === "exercise"
                            ? (blocks[i + 1] as Extract<Block, { kind: "exercise" }>)
                                .exerciseName
                            : undefined,
                      })
                  : undefined
              }
            />
            <InsertPoint onClick={() => setInsertAt(i + 1)} />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full border-t border-[color:var(--color-separator)] py-3 text-[15px] text-[color:var(--color-accent)] active:opacity-60"
        >
          Add exercise
        </button>

        {needsFinishMode && (
          <FinishModePrompt
            estimate={Math.round(estimatePlannedMinutes(workout))}
            onChoose={(mode, minutes) => void chooseFinishMode(mode, minutes)}
          />
        )}

        {timeLeftMs != null && timeLeftMs <= 0 && !showFinish && (
          <Card>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">
              Time's up
            </div>
            <div className="mt-1 text-[15px] text-[color:var(--color-muted)]">
              You set a {workout.timeCapMinutes}-minute cap. Finish here, or keep
              going — the clock doesn't stop you.
            </div>
            <Button size="lg" block className="mt-3" onClick={() => setShowFinish(true)}>
              Finish workout
            </Button>
          </Card>
        )}

        {/* Counted live, not from the snapshot — tick two of three carried sets
            off and the bar used to still offer to change all three. At zero it
            has nothing left to act on, so it goes away. */}
        {carry && liveCarryCount > 0 && (
          <CarryBar
            field={carry.field}
            value={carry.value}
            count={liveCarryCount}
            onAdjust={(d) => void adjustCarry(d)}
            onUndo={() => void undoCarry()}
            onDismiss={() => setCarry(null)}
          />
        )}

        {!showFinish ? (
          <Button size="lg" block onClick={() => setShowFinish(true)}>
            Finish workout
          </Button>
        ) : (
          <Card>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">
              Finish this workout?
            </div>
            {completedCount < totalCount && (
              <div className="mt-1 text-[15px] text-[color:var(--color-muted)]">
                {totalCount - completedCount}{" "}
                {totalCount - completedCount === 1 ? "set is" : "sets are"} still
                unlogged — they'll be saved as skipped.
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowFinish(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={finishWorkout}>
                Finish
              </Button>
            </div>
            {/* Throwing the session away lives behind the finish prompt rather
                than in the header: it's rare, and it's the one action here you
                can't undo. */}
            <button
              onClick={() => void discardWorkout()}
              className="mt-3 w-full text-center text-[13px] text-[color:var(--color-danger)] active:opacity-60"
            >
              Delete this workout
            </button>
          </Card>
        )}
      </div>

      {restSec !== null && (
        <RestTimer
          seconds={restSec}
          onDone={() => setRestSec(null)}
          onCancel={() => setRestSec(null)}
        />
      )}

      {manageOpen && (
        <ManagePlanSheet
          workout={workout}
          exercises={exercises}
          gifByExerciseId={gifByExerciseId}
          onChange={replaceSets}
          onClose={() => setManageOpen(false)}
        />
      )}

      {blockMenu && (
        <Sheet label={blockMenu.name} onClose={() => setBlockMenu(null)}>
          <div className="space-y-2 p-4 pb-8">
            <div className="px-1 text-[16px] font-semibold tracking-[-0.01em]">
              {blockMenu.name}
            </div>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setSwapFor(blockMenu.exerciseId);
                setBlockMenu(null);
              }}
            >
              Swap exercise…
            </Button>
            {/* One tap, no sheet-within-a-sheet: pair this exercise with the
                one after it. Creating a superset used to mean opening Manage,
                tapping two blocks, then Link. */}
            {blockMenu.nextName && (
              <Button
                variant="secondary"
                block
                onClick={() => {
                  void supersetWithNext(blockMenu.index);
                  setBlockMenu(null);
                }}
              >
                Superset with {blockMenu.nextName}
              </Button>
            )}
            <Button
              variant="secondary"
              block
              onClick={() => {
                setBlockMenu(null);
                setManageOpen(true);
              }}
            >
              Reorder & more…
            </Button>
            <button
              onClick={() => {
                void removeExercise(blockMenu.exerciseId);
                setBlockMenu(null);
              }}
              className="w-full py-2.5 text-center text-[15px] text-[color:var(--color-danger)] active:opacity-60"
            >
              Remove exercise
            </button>
          </div>
        </Sheet>
      )}

      {insertAt !== null && (
        <ExercisePicker
          title="Add exercise here"
          exercises={exercises}
          existingExerciseIds={new Set(workout.plannedSets.map((s) => s.exerciseId))}
          onPick={(ex) => void insertExercise(ex, insertAt)}
          onClose={() => setInsertAt(null)}
        />
      )}

      {swapFor && (
        <ExercisePicker
          exercises={exercises}
          existingExerciseIds={new Set(workout.plannedSets.map((s) => s.exerciseId))}
          onPick={(ex) => {
            void swapExercise(swapFor, ex);
            setSwapFor(null);
          }}
          onClose={() => setSwapFor(null)}
        />
      )}

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          existingExerciseIds={new Set(workout.plannedSets.map((s) => s.exerciseId))}
          onPick={addExerciseMid}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {singleTimerSet && (
        <SingleSetTimer
          set={singleTimerSet}
          onComplete={(s) =>
            patchSet(s.id, {
              completedAt: Date.now(),
              actualReps: s.actualReps ?? s.targetReps,
              actualWeight: s.actualWeight ?? s.targetWeight,
            })
          }
          onClose={() => setSingleTimerSet(null)}
        />
      )}

      {intervalSetup && (
        <IntervalSetupSheet
          onStart={(work, rest) => {
            setIntervalSetup(false);
            setIntervalRunning({ work, rest });
          }}
          onClose={() => setIntervalSetup(false)}
        />
      )}

      {intervalRunning && (
        <IntervalTimer
          sets={workout.plannedSets.filter((s) => s.workSeconds != null)}
          workSeconds={intervalRunning.work}
          restSeconds={intervalRunning.rest}
          onSetComplete={(s) =>
            patchSet(s.id, {
              completedAt: Date.now(),
              actualReps: s.actualReps ?? s.targetReps,
              actualWeight: s.actualWeight ?? s.targetWeight,
            })
          }
          onClose={() => setIntervalRunning(null)}
        />
      )}
    </div>
    </SwipeBack>
  );
}

/**
 * A hairline with a "+" between two exercises, on the live workout.
 *
 * Quiet enough to disappear into the gaps until you're looking for one — one
 * sits between every pair — but it means adding an exercise where you want it
 * no longer requires opening a sheet on top of the session you're doing.
 */
function InsertPoint({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add an exercise here"
      className="flex w-full items-center gap-2 py-1 active:opacity-60"
    >
      <span className="h-px flex-1 bg-[color:var(--color-separator)]" />
      <span className="grid size-4 shrink-0 place-items-center rounded-full text-[color:var(--color-muted-2)]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <span className="h-px flex-1 bg-[color:var(--color-separator)]" />
    </button>
  );
}

/**
 * Asked once when you open a session/**
 * Asked once when you open a session: does it end when the list ends, or when
 * the clock does?
 *
 * Offered rather than assumed because both are real ways to train and the app
 * can't tell which today is. The time options bracket the session's own
 * estimate, so the choice is "the usual", "a bit less" or "quick" rather than
 * arithmetic.
 */
function FinishModePrompt({
  estimate,
  onChoose,
}: {
  estimate: number;
  onChoose: (mode: "sets" | "time", minutes?: number) => void;
}) {
  // Round to a number someone would actually say, and keep the options apart.
  const round5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);
  const options = [...new Set([round5(estimate), round5(estimate * 0.7), 20])]
    .sort((a, b) => b - a)
    .slice(0, 3);
  return (
    <Card>
      <div className="text-[17px] font-semibold tracking-[-0.01em]">
        How are you finishing?
      </div>
      <div className="mt-1 text-[15px] leading-snug text-[color:var(--color-muted)]">
        Work through the whole list, or cap it and get as far as you get.
      </div>
      <Button size="lg" block className="mt-3" onClick={() => onChoose("sets")}>
        When all the sets are done
      </Button>
      <div className="mt-2 flex gap-2">
        {options.map((m) => (
          <Button
            key={m}
            variant="secondary"
            className="flex-1"
            onClick={() => onChoose("time", m)}
          >
            {m} min
          </Button>
        ))}
      </div>
    </Card>
  );
}

/**
 * The bar that appears after a weight or rep count is carried/**
 * The bar that appears after a weight or rep count is carried to the rest of
 * an exercise.
 *
 * It exists because the carry is a guess. Most of the time it's the right one
 * and you ignore this; when it isn't, the answer is almost always "same again
 * but a bit more" or "a bit less", so those are one tap rather than three
 * edits. Weight steps in 5s and reps in 1s, which is how people actually
 * change them.
 */
function CarryBar({
  field,
  value,
  count,
  onAdjust,
  onUndo,
  onDismiss,
}: {
  field: "actualWeight" | "actualReps";
  value: number;
  count: number;
  onAdjust: (delta: number) => void;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const isWeight = field === "actualWeight";
  const step = isWeight ? 5 : 1;
  const unit = isWeight ? "lb" : "reps";
  return (
    <div className="flex items-center gap-2 rounded-[12px] bg-[color:var(--color-surface)] px-3 py-2">
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
        <span className="tnum text-white">
          {value} {unit}
        </span>{" "}
        set for the next {count} set{count === 1 ? "" : "s"}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <StepButton label={`−${step}`} onClick={() => onAdjust(-step)} />
        <StepButton label={`+${step}`} onClick={() => onAdjust(step)} />
        <button
          onClick={onUndo}
          className="px-2 text-[13px] text-[color:var(--color-accent)] active:opacity-60"
        >
          Undo
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid size-7 place-items-center text-[color:var(--color-muted-2)] active:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-7 rounded-[8px] bg-[color:var(--color-surface-2)] px-2 text-[13px] font-medium tnum active:bg-[color:var(--color-surface-3)]"
    >
      {label}
    </button>
  );
}

/** Bottom-sheet picker for work/rest seconds before starting the interval timer. *//** Bottom-sheet picker for work/rest seconds before starting the interval timer. */
function IntervalSetupSheet({
  onStart,
  onClose,
}: {
  onStart: (work: number, rest: number) => void;
  onClose: () => void;
}) {
  const [work, setWork] = useState(45);
  const [rest, setRest] = useState(15);

  const presets = [
    { label: "30 / 15", work: 30, rest: 15 },
    { label: "45 / 15", work: 45, rest: 15 },
    { label: "60 / 20", work: 60, rest: 20 },
    { label: "40 / 20", work: 40, rest: 20 },
  ];

  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <button
          aria-label="Dismiss"
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <div
          className="animate-sheet-up relative w-full max-w-xl rounded-t-[16px] bg-[color:var(--color-surface)] px-6 pb-8 pt-2"
          style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[color:var(--color-muted-2)]" />
          <div className="flex items-center justify-between mb-4">
            <div className="text-[17px] font-semibold tracking-[-0.01em]">Interval timer</div>
            <button
              onClick={onClose}
              className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
            >
              Cancel
            </button>
          </div>

          <p className="mb-4 text-[15px] leading-snug text-[color:var(--color-muted)]">
            Runs through your remaining sets back-to-back. Alarm sounds at every
            transition; each finished set auto-marks complete.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-[13px] text-[color:var(--color-muted)]">
                Work (sec)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={600}
                value={work}
                onChange={(e) => setWork(Math.max(5, Number(e.target.value) || 0))}
                className="mt-1 h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] text-[color:var(--color-muted)]">
                Rest (sec)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                value={rest}
                onChange={(e) => setRest(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setWork(p.work);
                  setRest(p.rest);
                }}
                className="rounded-full bg-[color:var(--color-surface-2)] px-3.5 py-1.5 text-[13px] font-medium text-[color:var(--color-muted)] transition-colors active:bg-[color:var(--color-surface-3)]"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => onStart(work, rest)}
            className="w-full rounded-xl bg-[color:var(--color-accent)] py-3.5 text-[17px] font-semibold text-white transition-colors active:bg-[color:var(--color-accent-pressed)]"
          >
            Start interval
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/** Non-working set types get a letter instead of a number —
 *  W = warm-up, PT = rehab, S = stretch, D = drop set. */
function setTypeBadge(t: PlannedSet["setType"]): { label: string; cls: string } | null {
  switch (t) {
    case "Warm-up":
      return { label: "W", cls: "text-[color:var(--color-warn)]" };
    case "PT/Rehab":
      return { label: "PT", cls: "text-[color:var(--color-info)]" };
    case "Stretch":
      return { label: "S", cls: "text-[color:var(--color-info)]" };
    case "Drop":
      return { label: "D", cls: "text-[color:var(--color-danger)]" };
    default:
      return null;
  }
}

/**
 * One set as a Fitbod-style table row: [type/number chip] [lb] [reps]
 * [timer-or-note] [check]. Column labels are rendered once per card by the
 * parent BlockSection.
 */
function SetRow({
  set,
  index,
  label,
  labelTint,
  onPatch,
  onCarry,
  onToggle,
  onStartTimer,
}: {
  set: PlannedSet;
  index: number;
  /** Override chip text (superset rows pass "A1"/"B1"). */
  label?: string;
  /** Chip tint for superset rows: member A = accent, member B = info. */
  labelTint?: "accent" | "info";
  onPatch: (patch: Partial<PlannedSet>) => void;
  /** Same as onPatch, but fills the rest of the exercise too. */
  onCarry?: (patch: Partial<PlannedSet>) => void;
  onToggle: () => void;
  onStartTimer?: () => void;
}) {
  const done = !!set.completedAt;
  const [notesOpen, setNotesOpen] = useState(false);
  const badge = setTypeBadge(set.setType);
  const chipText = label ?? badge?.label ?? String(index);
  const chipCls = label
    ? labelTint === "info"
      ? "text-[color:var(--color-info)]"
      : "text-[color:var(--color-accent)]"
    : badge?.cls ?? "text-[color:var(--color-muted)]";
  // A set with a duration is measured in time, not reps — rowing, treadmill,
  // stair climber, timed holds.
  const timed = set.workSeconds != null;
  const showTimer = onStartTimer && timed && !done;

  return (
    <div className="px-3 py-1">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 shrink-0 text-center text-[15px] font-medium tnum ${
            done ? "text-[color:var(--color-muted-2)]" : chipCls
          }`}
        >
          {chipText}
        </div>
        {timed ? (
          <DurationCell
            seconds={set.workSeconds ?? 0}
            onChange={(secs) => onPatch({ workSeconds: secs })}
            done={done}
          />
        ) : (
          <>
            <BareNumber
              ariaLabel="Weight (lb)"
              value={set.actualWeight ?? set.targetWeight ?? 0}
              onChange={(v) => (onCarry ?? onPatch)({ actualWeight: v })}
              done={done}
            />
            <BareNumber
              ariaLabel="Reps"
              value={set.actualReps ?? set.targetReps}
              onChange={(v) => (onCarry ?? onPatch)({ actualReps: v })}
              done={done}
            />
          </>
        )}
        {showTimer ? (
          <button
            type="button"
            onClick={onStartTimer}
            className="flex h-9 shrink-0 items-center gap-1 rounded-[10px] bg-[color:var(--color-surface-2)] px-2.5 text-[13px] font-medium tnum text-[color:var(--color-accent)] active:bg-[color:var(--color-surface-3)]"
            aria-label={`Start ${set.workSeconds} second timer`}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
            {set.workSeconds}s
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            aria-label={set.userNotes ? "Edit note" : "Add note"}
            className={`grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors ${
              set.userNotes || notesOpen
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--color-muted-2)]"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
        {/* 36px tap target (gym-glove friendly) around a 26px mark, so a
            column of finished sets confirms without shouting. */}
        <button
          onClick={onToggle}
          aria-label={done ? "Mark set incomplete" : "Mark set complete"}
          className="grid size-9 shrink-0 place-items-center rounded-full"
        >
          <span
            className={`grid size-[26px] place-items-center rounded-full transition-colors ${
              done
                ? "bg-[color:var(--color-success)] text-white"
                : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted-2)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        </button>
      </div>
      {(notesOpen || set.userNotes) && (
        <textarea
          value={set.userNotes ?? ""}
          onChange={(e) => onPatch({ userNotes: e.target.value })}
          placeholder="How did it feel?"
          className="mb-1 mt-2 w-full resize-none rounded-[10px] bg-[color:var(--color-surface-2)] p-2.5 text-[15px] outline-none placeholder:text-[color:var(--color-muted-2)]"
          rows={2}
        />
      )}
    </div>
  );
}

/**
 * The lb / reps cells. A logged set goes quiet — transparent and muted —
 * so the eye lands on the row you still have to do, not the ten you already
 * finished.
 */
function BareNumber({
  value,
  onChange,
  done,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  done: boolean;
  ariaLabel: string;
}) {
  // An empty box means "still typing", not "zero". Committing every keystroke
  // meant backspacing a cell clear wrote Number("") === 0 — and the carry then
  // pushed that 0 onto every later set of the exercise. So emptiness is held
  // here and never committed; leave the field and the number comes back.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft ?? (value || "")}
      placeholder="—"
      onChange={(e) => {
        const next = e.target.value;
        if (next === "") return setDraft("");
        setDraft(null);
        onChange(Number(next));
      }}
      onBlur={() => setDraft(null)}
      onFocus={(e) => e.currentTarget.select()}
      className={`h-9 min-w-0 flex-1 border-b bg-transparent text-center text-[16px] font-medium tnum outline-none transition-colors ${
        done
          ? "border-transparent text-[color:var(--color-muted)]"
          : "border-[color:var(--color-separator)] focus:border-[color:var(--color-accent)]"
      }`}
    />
  );
}

/** Column labels above the set rows — shares the row's flex proportions. */
function SetColumnLabels({ timed = false }: { timed?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-1 text-[12px] text-[color:var(--color-muted-2)]">
      <span className="w-8 shrink-0 text-center">Set</span>
      {timed ? (
        <span className="flex-1 text-center">Time</span>
      ) : (
        <>
          <span className="flex-1 text-center">lb</span>
          <span className="flex-1 text-center">Reps</span>
        </>
      )}
      <span className="w-9 shrink-0" />
      <span className="w-9 shrink-0" />
    </div>
  );
}

/**
 * Duration field for a timed set, edited in minutes and seconds.
 *
 * Minutes is the unit people think in for a cardio block, but holds are
 * usually sub-minute, so both are editable and the seconds box only shows a
 * value when it's not a round number of minutes.
 */
function DurationCell({
  seconds,
  onChange,
  done,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
  done: boolean;
}) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const cls = `h-9 min-w-0 flex-1 border-b bg-transparent text-center text-[16px] font-medium tnum outline-none transition-colors ${
    done
      ? "border-transparent text-[color:var(--color-muted)]"
      : "border-[color:var(--color-separator)] focus:border-[color:var(--color-accent)]"
  }`;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        aria-label="Minutes"
        min={0}
        value={mins || ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 60 + secs)}
        onFocus={(e) => e.currentTarget.select()}
        className={cls}
      />
      <span className="shrink-0 text-[13px] text-[color:var(--color-muted-2)]">m</span>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Seconds"
        min={0}
        max={59}
        value={secs || ""}
        placeholder="0"
        onChange={(e) =>
          onChange(mins * 60 + Math.max(0, Math.min(59, Number(e.target.value) || 0)))
        }
        onFocus={(e) => e.currentTarget.select()}
        className={cls}
      />
      <span className="shrink-0 text-[13px] text-[color:var(--color-muted-2)]">s</span>
    </div>
  );
}

/**
 * Renders one "block" in the workout — either a single exercise or a superset
 * of 2+ exercises. Pure execution view: no reorder/link controls (those live
 * in ManagePlanSheet to keep this screen focused on logging sets).
 */
/**
 * A finished exercise, folded down to one row: small thumb, name, what you
 * actually lifted, and a check. Tap anywhere to reopen and edit.
 *
 * Deliberately lighter than a live block — smaller thumbnail, muted summary —
 * so a screen of completed work reads as background rather than competing with
 * the set you're on.
 */
function CollapsedBlock({
  title,
  summary,
  thumbName,
  thumbUrl,
  onExpand,
}: {
  title: string;
  summary: string;
  thumbName: string;
  thumbUrl?: string;
  onExpand: () => void;
}) {
  return (
    <section className="py-1">
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={false}
        aria-label={`${title} — done. Show sets`}
        className="flex w-full items-center gap-3 rounded-[10px] px-1 py-2 text-left transition-colors active:bg-[color:var(--color-surface)]"
      >
        <span className="shrink-0 overflow-hidden rounded-full">
          <ExerciseGif name={thumbName} gifUrl={thumbUrl} size="mini" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] leading-tight tracking-[-0.01em] text-[color:var(--color-muted)]">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[13px] tnum text-[color:var(--color-muted-2)]">
            {summary}
          </div>
        </div>
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[color:var(--color-success)] text-white">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <svg
          className="shrink-0 text-[color:var(--color-muted-2)]"
          width="12" height="8" viewBox="0 0 12 8" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="1 1.5 6 6.5 11 1.5" />
        </svg>
      </button>
    </section>
  );
}

/**
 * "3 × 15 @ 10 lb" — consecutive identical sets collapse into one term, so a
 * straight-across block reads as one phrase and a ramp reads as its steps.
 */
function summarizeSets(sets: PlannedSet[]): string {
  type Run = { reps: number; weight?: number; secs?: number; count: number };
  const runs: Run[] = [];
  for (const s of sets) {
    const reps = s.actualReps ?? s.targetReps;
    const weight = s.actualWeight ?? s.targetWeight ?? undefined;
    const secs = s.workSeconds ?? undefined;
    const last = runs[runs.length - 1];
    if (last && last.reps === reps && last.weight === weight && last.secs === secs) {
      last.count += 1;
    } else {
      runs.push({ reps, weight, secs, count: 1 });
    }
  }
  if (runs.length === 0) return "";
  // A long ramp would overflow the row; past three terms just give the count.
  if (runs.length > 3) return `${sets.length} sets`;
  return runs
    .map((r) =>
      r.secs != null
        ? `${r.count} × ${r.secs}s`
        : `${r.count} × ${r.reps}${r.weight ? ` @ ${r.weight} lb` : ""}`
    )
    .join(" · ");
}

function BlockSection({
  block,
  gifByExerciseId,
  onPatch,
  onCarry,
  onDelete,
  onToggle,
  onAddSetToExercise,
  onStartSetTimer,
  onMenu,
}: {
  block: Block;
  gifByExerciseId: Map<string, string | undefined>;
  onPatch: (id: string, patch: Partial<PlannedSet>) => void;
  onCarry: (id: string, patch: Partial<PlannedSet>) => void;
  onDelete: (id: string) => void;
  onToggle: (set: PlannedSet) => void;
  onAddSetToExercise: (exerciseId: string) => void;
  onStartSetTimer: (set: PlannedSet) => void;
  onMenu?: () => void;
}) {
  // Tapping the thumbnail expands a full-width demo. Kept collapsed by default
  // so the set table stays the focus, but the demo is one tap away mid-set.
  const [demoOpen, setDemoOpen] = useState(false);

  // A finished exercise folds down to one summary row, so the sets you still
  // have to do stay near the top of the screen instead of behind three screens
  // of already-logged work.
  //
  // `manualOpen` is a deliberate override: null means "follow completion".
  // Resetting it whenever `blockDone` flips means finishing a block collapses
  // it even if you'd expanded it by hand, and un-checking a set re-opens it.
  const blockSets =
    block.kind === "exercise" ? block.sets : block.members.flatMap((m) => m.sets);
  const blockDone = blockSets.length > 0 && blockSets.every((s) => !!s.completedAt);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setManualOpen(null);
  }, [blockDone]);
  const collapsed = manualOpen === null ? blockDone : !manualOpen;

  if (block.kind === "exercise") {
    const isPT = block.sets.some((s) => s.setType === "PT/Rehab");
    const groupDone = blockDone;
    const groupCount = block.sets.filter((s) => s.completedAt).length;
    // Cues live on every set of the block; show it once, under the name.
    const blockCue = block.sets.find((s) => s.notes)?.notes;

    if (collapsed) {
      return (
        <CollapsedBlock
          title={block.exerciseName}
          summary={summarizeSets(block.sets)}
          thumbName={block.exerciseName}
          thumbUrl={gifByExerciseId.get(block.exerciseId)}
          onExpand={() => setManualOpen(true)}
        />
      );
    }

    return (
      <section className="py-1">
        {/* Card header — thumb (tap to expand demo), name, progress */}
        <div className="flex items-center gap-3 px-1 py-2">
          <button
            type="button"
            onClick={() => setDemoOpen((o) => !o)}
            aria-label={demoOpen ? "Hide demo" : "Show demo"}
            aria-expanded={demoOpen}
            className="shrink-0 overflow-hidden rounded-full active:opacity-70"
          >
            <ExerciseGif
              name={block.exerciseName}
              gifUrl={gifByExerciseId.get(block.exerciseId)}
              size="mini"
            />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold leading-tight tracking-[-0.01em]">
              {block.exerciseName}
            </h2>
            <div className="mt-0.5 text-[13px] tnum text-[color:var(--color-muted)]">
              {groupCount} of {block.sets.length} sets
              {isPT && " · PT"}
            </div>
            {blockCue && (
              <div className="mt-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
                {blockCue}
              </div>
            )}
          </div>
          {groupDone && (
            <div className="grid size-6 shrink-0 place-items-center rounded-full bg-[color:var(--color-success)] text-white">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label={`Options for ${block.exerciseName}`}
              className="grid size-8 shrink-0 place-items-center rounded-full text-[color:var(--color-muted)] active:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.9" />
                <circle cx="12" cy="12" r="1.9" />
                <circle cx="19" cy="12" r="1.9" />
              </svg>
            </button>
          )}
        </div>

        {demoOpen && (
          <div className="px-3 pb-3">
            <ExerciseGif
              name={block.exerciseName}
              gifUrl={gifByExerciseId.get(block.exerciseId)}
              size="banner"
            />
          </div>
        )}

        <SetColumnLabels timed={block.sets.every((x) => x.workSeconds != null)} />
        <div className="pb-1">
          {block.sets.map((s, i) => (
            <SwipeToDelete key={s.id} onDelete={() => onDelete(s.id)}>
              <SetRow
                set={s}
                index={i + 1}
                onPatch={(patch) => onPatch(s.id, patch)}
                onCarry={(patch) => onCarry(s.id, patch)}
                onToggle={() => onToggle(s)}
                onStartTimer={s.workSeconds != null ? () => onStartSetTimer(s) : undefined}
              />
            </SwipeToDelete>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAddSetToExercise(block.exerciseId)}
          className="w-full border-t border-[color:var(--color-separator)] py-2.5 text-[15px] text-[color:var(--color-accent)] active:bg-[color:var(--color-surface-2)]"
        >
          Add set
        </button>
      </section>
    );
  }

  // Superset block
  const interleaved = interleaveSupersetSets(block);
  const allSets = block.members.flatMap((m) => m.sets);
  const doneCount = allSets.filter((s) => s.completedAt).length;
  const isPT = allSets.some((s) => s.setType === "PT/Rehab");

  if (collapsed) {
    return (
      <CollapsedBlock
        title={block.members.map((m) => m.exerciseName).join(" + ")}
        summary={`Superset · ${summarizeSets(allSets)}`}
        thumbName={block.members[0].exerciseName}
        thumbUrl={gifByExerciseId.get(block.members[0].exerciseId)}
        onExpand={() => setManualOpen(true)}
      />
    );
  }

  return (
    <section className="py-1">
      <div className="px-1 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Tag variant="accent">Superset</Tag>
              {isPT && <Tag variant="info">PT</Tag>}
            </div>
            <h2 className="mt-1.5 truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">
              {block.members.map((m) => m.exerciseName).join(" + ")}
            </h2>
            <div className="mt-0.5 text-[13px] tnum text-[color:var(--color-muted)]">
              {doneCount} of {allSets.length} sets · alternate A → B
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDemoOpen((o) => !o)}
          aria-expanded={demoOpen}
          aria-label={demoOpen ? "Hide demos" : "Show demos"}
          className="mt-3 grid w-full grid-cols-2 gap-2 text-left"
        >
          {block.members.map((m, mi) => (
            <div
              key={m.exerciseId}
              className="flex min-w-0 items-center gap-2 py-1"
            >
              <span
                className={`shrink-0 text-[13px] font-semibold ${
                  mi === 0
                    ? "text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-info)]"
                }`}
              >
                {String.fromCharCode(65 + mi)}
              </span>
              <span
                className={`shrink-0 overflow-hidden ${
                  demoOpen ? "rounded-[10px]" : "rounded-full"
                }`}
              >
                <ExerciseGif
                  name={m.exerciseName}
                  gifUrl={gifByExerciseId.get(m.exerciseId)}
                  size={demoOpen ? "card" : "mini"}
                />
              </span>
              <div className="line-clamp-2 min-w-0 text-[13px] leading-tight">
                {m.exerciseName}
              </div>
            </div>
          ))}
        </button>
      </div>

      <SetColumnLabels />
      <div className="pb-2">
        {interleaved.map((step) => (
          <SwipeToDelete key={step.set.id} onDelete={() => onDelete(step.set.id)}>
            <SetRow
              set={step.set}
              index={step.round + 1}
              label={`${String.fromCharCode(65 + step.memberIndex)}${step.round + 1}`}
              labelTint={step.memberIndex === 0 ? "accent" : "info"}
              onPatch={(patch) => onPatch(step.set.id, patch)}
              onCarry={(patch) => onCarry(step.set.id, patch)}
              onToggle={() => onToggle(step.set)}
              onStartTimer={step.set.workSeconds != null ? () => onStartSetTimer(step.set) : undefined}
            />
          </SwipeToDelete>
        ))}
      </div>
    </section>
  );
}

