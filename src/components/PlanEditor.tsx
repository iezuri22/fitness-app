import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Exercise, PlannedSet, Workout } from "../lib/types";
import { renumber } from "../lib/blocks";
import { defaultEstimatedMinutes, setEstimatedMinutes } from "../lib/duration";
import { Card, Tag } from "./ui";
import ExerciseGif from "./ExerciseGif";
import ExercisePicker from "./ExercisePicker";
import {
  buildBlocks,
  moveBlock,
  linkAsSuperset,
  unlinkSuperset,
  type Block,
} from "../lib/blocks";

/**
 * PlanEditor renders the list of exercise blocks for a workout, each with its
 * GIF, sets, and (when `editable`) inline controls for tweaking reps/weight,
 * adding/removing sets, removing the whole exercise, and adding new exercises
 * from the catalog.
 *
 * The parent owns the workout state + persistence. PlanEditor only renders and
 * invokes `onChange(nextSets)` when the user makes an edit. The parent is
 * expected to do an optimistic local update + firestore write.
 *
 * Used by both Today (pre-workout edit) and WorkoutDetail (planned detail).
 */
/**
 * How a set reads in a summary. A treadmill or rower set carries a duration,
 * not reps — showing "8 reps" for an 8-minute block is actively misleading,
 * which is exactly how it looked before.
 */
function setLabel(s: PlannedSet): string {
  if (s.workSeconds == null) return `${s.targetReps} reps`;
  const m = Math.floor(s.workSeconds / 60);
  const sec = s.workSeconds % 60;
  if (m && sec) return `${m}m ${sec}s`;
  return m ? `${m} min` : `${sec}s`;
}

export default function PlanEditor({
  workout,
  exercises,
  editable,
  onChange,
}: {
  workout: Workout;
  exercises: Exercise[];
  editable: boolean;
  onChange: (nextSets: PlannedSet[]) => void | Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const gifByExerciseId = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const ex of exercises) m.set(ex.id, ex.gifUrl);
    return m;
  }, [exercises]);

  const blocks = buildBlocks(workout);
  const isUpcoming = workout.status === "planned" || workout.status === "in_progress";

  async function updatePlannedSet(setId: string, patch: Partial<PlannedSet>) {
    const nextSets = workout.plannedSets.map((s) =>
      s.id === setId ? { ...s, ...patch } : s
    );
    await onChange(nextSets);
  }

  async function addSetToExercise(exerciseId: string) {
    const groupSets = workout.plannedSets.filter((s) => s.exerciseId === exerciseId);
    const last = groupSets[groupSets.length - 1];
    if (!last) return;
    const newSet: PlannedSet = {
      id: crypto.randomUUID(),
      exerciseId: last.exerciseId,
      exerciseName: last.exerciseName,
      // See renumber() — array position is the sequence, not this number.
      order: 0,
      targetReps: last.targetReps,
      targetWeight: last.targetWeight,
      setType: last.setType,
      restSeconds: last.restSeconds,
      // Keep the duration, or a timed set clones into a reps set.
      workSeconds: last.workSeconds,
      // Clone the minute estimate from the previous set (falling back to the
      // smart default for this exercise if the previous set has none).
      estimatedMinutes:
        last.estimatedMinutes ?? defaultEstimatedMinutes(last.exerciseName),
      notes: "",
      completedAt: null,
    };
    const lastIdx = workout.plannedSets.findIndex((s) => s.id === last.id);
    const nextSets = [...workout.plannedSets];
    nextSets.splice(lastIdx + 1, 0, newSet);
    await onChange(renumber(nextSets));
  }

  async function addExercise(ex: Exercise) {
    const maxOrder = Math.max(...workout.plannedSets.map((s) => s.order), 0);
    const newSet: PlannedSet = {
      id: crypto.randomUUID(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      order: maxOrder + 1,
      targetReps: 10,
      targetWeight: undefined,
      setType: ex.isPT ? "PT/Rehab" : "Working",
      restSeconds: 60,
      estimatedMinutes: defaultEstimatedMinutes(ex.name),
      notes: "",
      completedAt: null,
    };
    await onChange([...workout.plannedSets, newSet]);
    setPickerOpen(false);
  }

  async function removeSet(setId: string) {
    await onChange(workout.plannedSets.filter((s) => s.id !== setId));
  }

  async function removeExercise(exerciseId: string) {
    await onChange(workout.plannedSets.filter((s) => s.exerciseId !== exerciseId));
  }

  async function moveBlockAction(blockIndex: number, dir: "up" | "down") {
    const next = moveBlock(workout, blockIndex, dir);
    if (next === workout.plannedSets) return;
    await onChange(next);
  }

  async function linkAction(blockIndex: number) {
    const next = linkAsSuperset(workout, blockIndex);
    if (next === workout.plannedSets) return;
    await onChange(next);
  }

  async function unlinkAction(blockIndex: number) {
    const next = unlinkSuperset(workout, blockIndex);
    if (next === workout.plannedSets) return;
    await onChange(next);
  }

  return (
    <>
      <div className="space-y-4">
        {blocks.map((b) => (
          <PlanBlock
            key={b.kind === "exercise" ? `ex:${b.exerciseId}` : `ss:${b.supersetGroupId}`}
            block={b}
            totalBlocks={blocks.length}
            editable={editable}
            isUpcoming={isUpcoming}
            gifByExerciseId={gifByExerciseId}
            onPatch={updatePlannedSet}
            onRemoveSet={removeSet}
            onAddSetToExercise={addSetToExercise}
            onRemoveExercise={removeExercise}
            onMove={moveBlockAction}
            onLink={linkAction}
            onUnlink={unlinkAction}
          />
        ))}
        {editable && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full text-sm font-semibold text-[color:var(--color-accent)] border-2 border-dashed border-[color:var(--color-border)] rounded-lg py-4 hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/5"
          >
            + Add exercise
          </button>
        )}
      </div>

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          existingExerciseIds={new Set(workout.plannedSets.map((s) => s.exerciseId))}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/** Render minutes with at most one decimal, stripping a trailing ".0". */
function formatMinutes(m: number): string {
  const rounded = Math.round(m * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Renders one "block" in the plan — either a single exercise card or a superset
 * card wrapping 2+ exercises. Supersets surface an interleave hint (A→B→A→B)
 * but the rows within the card are still grouped by exercise to keep editing
 * friendly; only the workout execution screen interleaves them for labeling.
 */
function PlanBlock({
  block,
  totalBlocks,
  editable,
  isUpcoming,
  gifByExerciseId,
  onPatch,
  onRemoveSet,
  onAddSetToExercise,
  onRemoveExercise,
  onMove,
  onLink,
  onUnlink,
}: {
  block: Block;
  totalBlocks: number;
  editable: boolean;
  isUpcoming: boolean;
  gifByExerciseId: Map<string, string | undefined>;
  onPatch: (setId: string, patch: Partial<PlannedSet>) => void | Promise<void>;
  onRemoveSet: (setId: string) => void | Promise<void>;
  onAddSetToExercise: (exerciseId: string) => void | Promise<void>;
  onRemoveExercise: (exerciseId: string) => void | Promise<void>;
  onMove: (blockIndex: number, dir: "up" | "down") => void | Promise<void>;
  onLink: (blockIndex: number) => void | Promise<void>;
  onUnlink: (blockIndex: number) => void | Promise<void>;
}) {
  const canMoveUp = block.index > 0;
  const canMoveDown = block.index < totalBlocks - 1;
  const canLinkNext = block.index < totalBlocks - 1;

  const members =
    block.kind === "exercise"
      ? [
          {
            exerciseId: block.exerciseId,
            exerciseName: block.exerciseName,
            sets: block.sets,
          },
        ]
      : block.members;

  const isSuperset = block.kind === "superset";

  return (
    <Card
      className={
        isSuperset
          ? "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/[0.04]"
          : undefined
      }
    >
      {isSuperset && (
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--color-accent)]">
            Superset · {members.length} exercises
          </div>
          <div className="text-[13px] text-[color:var(--color-muted-2)]">
            A → B {members.length > 2 ? "→ C" : ""}
          </div>
        </div>
      )}

      {editable && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <ActionPill
            onClick={() => onMove(block.index, "up")}
            disabled={!canMoveUp}
            label="Move up"
          >
            ↑
          </ActionPill>
          <ActionPill
            onClick={() => onMove(block.index, "down")}
            disabled={!canMoveDown}
            label="Move down"
          >
            ↓
          </ActionPill>
          {isSuperset ? (
            <ActionPill onClick={() => onUnlink(block.index)} label="Unlink superset">
              Unlink
            </ActionPill>
          ) : (
            <ActionPill
              onClick={() => onLink(block.index)}
              disabled={!canLinkNext}
              label="Link with next"
            >
              + Link with next
            </ActionPill>
          )}
        </div>
      )}

      <div className={isSuperset ? "space-y-4" : undefined}>
        {members.map((m) => (
          <div key={m.exerciseId}>
            <div className="flex items-start gap-3 mb-3">
              <Link
                to={`/exercises/${m.exerciseId}`}
                className="shrink-0"
                aria-label={`Open ${m.exerciseName}`}
              >
                <ExerciseGif
                  name={m.exerciseName}
                  gifUrl={gifByExerciseId.get(m.exerciseId)}
                  size="card"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/exercises/${m.exerciseId}`}
                  className="font-semibold hover:underline block"
                >
                  {m.exerciseName}
                </Link>
                <div className="text-xs text-[color:var(--color-muted)] mt-0.5">
                  {m.sets.length} set{m.sets.length === 1 ? "" : "s"}
                </div>
                {m.sets.some((s) => s.setType === "PT/Rehab") && (
                  <div className="mt-1.5">
                    <Tag variant="accent">PT/Rehab</Tag>
                  </div>
                )}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${m.exerciseName} from this workout?`)) {
                      void onRemoveExercise(m.exerciseId);
                    }
                  }}
                  className="shrink-0 text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] p-1 -m-1"
                  aria-label={`Remove ${m.exerciseName}`}
                  title="Remove exercise"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            <div className="divide-y divide-[color:var(--color-border)]">
              {m.sets.map((s, i) => (
                <div key={s.id} className="py-2 text-sm">
                  {editable && !s.completedAt ? (
                    <EditablePlannedSetRow
                      index={i}
                      set={s}
                      onChange={(patch) => onPatch(s.id, patch)}
                      onRemove={m.sets.length > 1 ? () => onRemoveSet(s.id) : undefined}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[color:var(--color-muted)]">Set {i + 1}</div>
                      <div className="tabular-nums flex items-center gap-2">
                        {s.completedAt ? (
                          <>
                            <span className="font-semibold">
                              {s.actualReps ?? 0} reps
                            </span>
                            {s.actualWeight ? (
                              <span className="text-[color:var(--color-muted)]">
                                {" "}
                                @ {s.actualWeight}lb
                              </span>
                            ) : null}
                          </>
                        ) : isUpcoming ? (
                          <>
                            <span className="text-[color:var(--color-muted)]">
                              <span className="font-semibold text-white">
                                {setLabel(s)}
                              </span>
                              {s.workSeconds == null && s.targetWeight ? (
                                <> @ {s.targetWeight}lb</>
                              ) : null}
                            </span>
                            <span className="rounded bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-[12px] tnum text-[color:var(--color-muted-2)]">
                              ~{formatMinutes(setEstimatedMinutes(s))}m
                            </span>
                          </>
                        ) : (
                          <span className="text-[color:var(--color-danger)]">skipped</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editable && (
              <button
                type="button"
                onClick={() => onAddSetToExercise(m.exerciseId)}
                className="mt-2 w-full rounded-[10px] border border-dashed border-[color:var(--color-border)] py-2 text-[15px] text-[color:var(--color-accent)] transition-colors active:bg-[color:var(--color-accent)]/10"
              >
                Add another set
              </button>
            )}
            {m.sets.some((s) => s.userNotes) && (
              <div className="mt-2 pt-2 border-t border-[color:var(--color-border)] space-y-1">
                {m.sets
                  .filter((s) => s.userNotes)
                  .map((s, i) => (
                    <div key={i} className="text-xs italic text-[color:var(--color-muted)]">
                      "{s.userNotes}"
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActionPill({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-2)] px-2.5 py-1 text-[13px] font-medium text-[color:var(--color-muted)] transition-colors active:bg-[color:var(--color-surface-3)] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Inline editor for a planned set. Renders as a read-only-looking row by
 * default; tapping "Edit" expands reps/weight/notes fields. Changes commit on
 * blur via the parent's `onChange` handler (which writes to Firestore).
 *
 * Reps convention: for cardio entries like "Running" we use reps = minutes,
 * so editing lets the user bump the treadmill from 30 → 20 etc.
 */
function EditablePlannedSetRow({
  index,
  set,
  onChange,
  onRemove,
}: {
  index: number;
  set: PlannedSet;
  onChange: (patch: Partial<PlannedSet>) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reps, setReps] = useState(String(set.targetReps));
  const [weight, setWeight] = useState(
    set.targetWeight != null ? String(set.targetWeight) : ""
  );
  const [minutes, setMinutes] = useState(
    set.estimatedMinutes != null
      ? String(set.estimatedMinutes)
      : String(setEstimatedMinutes(set).toFixed(1).replace(/\.0$/, ""))
  );
  const [notes, setNotes] = useState(set.notes ?? "");

  useEffect(() => {
    setReps(String(set.targetReps));
    setWeight(set.targetWeight != null ? String(set.targetWeight) : "");
    setMinutes(
      set.estimatedMinutes != null
        ? String(set.estimatedMinutes)
        : String(setEstimatedMinutes(set).toFixed(1).replace(/\.0$/, ""))
    );
    setNotes(set.notes ?? "");
  }, [set.targetReps, set.targetWeight, set.estimatedMinutes, set.notes, set]);

  function commit() {
    const nextReps = Number(reps);
    const nextWeight = weight === "" ? undefined : Number(weight);
    const nextMinutes = minutes === "" ? undefined : Number(minutes);
    const patch: Partial<PlannedSet> = {};
    if (!Number.isNaN(nextReps) && nextReps !== set.targetReps) {
      patch.targetReps = nextReps;
    }
    if (nextWeight !== set.targetWeight) {
      patch.targetWeight = nextWeight;
    }
    if (nextMinutes !== set.estimatedMinutes && !Number.isNaN(nextMinutes as number)) {
      patch.estimatedMinutes = nextMinutes;
    }
    if (notes !== (set.notes ?? "")) {
      patch.notes = notes;
    }
    if (Object.keys(patch).length > 0) {
      void onChange(patch);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between text-left group"
        aria-label={`Edit set ${index + 1}`}
      >
        <div className="text-[color:var(--color-muted)]">Set {index + 1}</div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-[color:var(--color-muted)]">
            <span className="font-semibold text-white">{setLabel(set)}</span>
            {set.workSeconds == null && set.targetWeight ? (
              <> @ {set.targetWeight}lb</>
            ) : null}
          </span>
          <span className="rounded bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-[12px] tnum text-[color:var(--color-muted-2)]">
            ~{formatMinutes(setEstimatedMinutes(set))}m
          </span>
          <span
            className="text-[13px] text-[color:var(--color-accent)] opacity-70 group-hover:opacity-100"
            aria-hidden="true"
          >
            Edit
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[color:var(--color-muted)]">Set {index + 1}</div>
        <button
          type="button"
          onClick={() => {
            commit();
            setOpen(false);
          }}
          className="text-xs text-[color:var(--color-muted)] hover:text-white"
        >
          Done
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[13px] text-[color:var(--color-muted)]">
            Reps
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={commit}
            className="mt-1 h-10 w-full rounded-[10px] bg-[color:var(--color-surface-2)] px-2.5 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-[color:var(--color-muted)]">
            Weight (lb)
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="—"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={commit}
            className="mt-1 h-10 w-full rounded-[10px] bg-[color:var(--color-surface-2)] px-2.5 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
          />
        </label>
        <label className="block">
          <span className="text-[13px] text-[color:var(--color-muted)]">
            Minutes
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onBlur={commit}
            className="mt-1 h-10 w-full rounded-[10px] bg-[color:var(--color-surface-2)] px-2.5 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[13px] text-[color:var(--color-muted)]">
          Notes
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commit}
          rows={2}
          className="mt-1 w-full rounded-[10px] bg-[color:var(--color-surface-2)] px-2.5 py-2 text-[16px] outline-none focus:bg-[color:var(--color-surface-3)]"
        />
      </label>
      {onRemove && (
        <button
          type="button"
          onClick={() => void onRemove()}
          className="text-xs text-[color:var(--color-danger)] hover:underline"
        >
          Remove this set
        </button>
      )}
    </div>
  );
}

