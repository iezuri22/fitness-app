import { useState } from "react";
import type { Exercise, PlannedSet, SetType, Workout } from "../lib/types";
import {
  buildBlocks,
  moveBlockToIndex,
  linkMultipleBlocksAsSuperset,
  unlinkSuperset,
  type Block,
} from "../lib/blocks";
import ExerciseGif from "./ExerciseGif";
import ExercisePicker from "./ExercisePicker";

/**
 * Full-screen management sheet for an in-progress workout. Interaction model:
 *   1. Tap a block's header → it gets added to the current SELECTION. Tap it
 *      again to remove it.
 *   2. While ≥2 blocks are selected, the bottom bar offers "Superset (N)".
 *      They get linked under one supersetGroupId (moved adjacent in tap-order).
 *   3. When exactly 1 block is selected, "Move here" drop slots appear
 *      between every other block.
 *   4. Each selected block expands inline — you can edit reps / weight / set
 *      type / delete set directly, without leaving the sheet.
 *   5. Each row has a "⏱" pill (stops propagation) to edit the block's
 *      per-set timer — now with separate min + sec fields and long-duration
 *      presets (3 min / 30 min).
 */
export default function ManagePlanSheet({
  workout,
  exercises,
  gifByExerciseId,
  onChange,
  onClose,
}: {
  workout: Workout;
  exercises: Exercise[];
  gifByExerciseId: Map<string, string | undefined>;
  onChange: (nextSets: PlannedSet[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [timerEditor, setTimerEditor] = useState<{
    setIds: string[];
    work: number;
    rest: number;
    label: string;
  } | null>(null);

  // `indices` captures tap order — used as the superset order when linking.
  type Mode = { kind: "idle" } | { kind: "selecting"; indices: number[] };
  const [mode, setMode] = useState<Mode>({ kind: "idle" });

  // Drag-and-drop reorder. Parallel to tap-to-select → Move here — either
  // interaction path works. `draggingIndex` is the block index being dragged
  // (null when not dragging). All valid MoveSlot drop targets appear
  // simultaneously while a drag is in flight.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const blocks = buildBlocks(workout);
  const selectedIndices =
    mode.kind === "selecting" ? mode.indices : ([] as number[]);
  const soloSelectedIndex =
    selectedIndices.length === 1 ? selectedIndices[0] : null;
  const selectedBlocks = selectedIndices
    .map((i) => blocks[i])
    .filter(Boolean) as Block[];

  function toggleSelect(blockIndex: number) {
    if (mode.kind !== "selecting") {
      setMode({ kind: "selecting", indices: [blockIndex] });
      return;
    }
    if (mode.indices.includes(blockIndex)) {
      const next = mode.indices.filter((i) => i !== blockIndex);
      setMode(next.length === 0 ? { kind: "idle" } : { kind: "selecting", indices: next });
    } else {
      setMode({ kind: "selecting", indices: [...mode.indices, blockIndex] });
    }
  }

  async function moveTo(toIndex: number) {
    if (soloSelectedIndex == null) return;
    const next = moveBlockToIndex(workout, soloSelectedIndex, toIndex);
    if (next === workout.plannedSets) {
      setMode({ kind: "idle" });
      return;
    }
    await onChange(next);
    setMode({ kind: "idle" });
  }

  /** Drag-drop version of moveTo — uses draggingIndex instead of a selection. */
  async function dragMoveTo(toIndex: number) {
    if (draggingIndex == null) return;
    const next = moveBlockToIndex(workout, draggingIndex, toIndex);
    setDraggingIndex(null);
    if (next === workout.plannedSets) return;
    await onChange(next);
  }

  async function supersetSelected() {
    if (selectedIndices.length < 2) return;
    const next = linkMultipleBlocksAsSuperset(workout, selectedIndices);
    if (next === workout.plannedSets) {
      setMode({ kind: "idle" });
      return;
    }
    await onChange(next);
    setMode({ kind: "idle" });
  }

  async function doUnlink(blockIndex: number) {
    const next = unlinkSuperset(workout, blockIndex);
    if (next === workout.plannedSets) return;
    await onChange(next);
    setMode({ kind: "idle" });
  }

  async function addExercise(ex: Exercise) {
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
      notes: "",
      completedAt: null,
    };
    await onChange([...workout.plannedSets, newSet]);
    setPickerOpen(false);
  }

  async function patchSet(setId: string, patch: Partial<PlannedSet>) {
    const next = workout.plannedSets.map((s) =>
      s.id === setId ? { ...s, ...patch } : s
    );
    await onChange(next);
  }

  async function duplicateSet(setId: string) {
    const source = workout.plannedSets.find((s) => s.id === setId);
    if (!source) return;
    const idx = workout.plannedSets.findIndex((s) => s.id === setId);
    const clone: PlannedSet = {
      ...source,
      id: crypto.randomUUID(),
      completedAt: null,
      actualReps: undefined,
      actualWeight: undefined,
      userNotes: "",
    };
    const next = [
      ...workout.plannedSets.slice(0, idx + 1),
      clone,
      ...workout.plannedSets.slice(idx + 1),
    ].map((s, i) => ({ ...s, order: i + 1 }));
    await onChange(next);
  }

  async function removeSet(setId: string) {
    const next = workout.plannedSets
      .filter((s) => s.id !== setId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    await onChange(next);
  }

  async function saveTimer(setIds: string[], work: number, rest: number) {
    const ids = new Set(setIds);
    const next = workout.plannedSets.map((s) =>
      ids.has(s.id)
        ? {
            ...s,
            workSeconds: work > 0 ? work : undefined,
            restSeconds: rest > 0 ? rest : s.restSeconds,
          }
        : s
    );
    await onChange(next);
    setTimerEditor(null);
  }

  async function clearTimer(setIds: string[]) {
    const ids = new Set(setIds);
    const next = workout.plannedSets.map((s) =>
      ids.has(s.id) ? { ...s, workSeconds: undefined } : s
    );
    await onChange(next);
    setTimerEditor(null);
  }

  const hint =
    mode.kind === "idle"
      ? "Tap an exercise to edit sets, move, or superset"
      : selectedIndices.length === 1
      ? "Tap more exercises to superset, or tap a slot to move"
      : `Tap "Superset (${selectedIndices.length})" to link, or tap another to add`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[color:var(--color-bg)]">
      <header
        className="border-b border-[color:var(--color-border)] px-5 pb-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[17px] font-semibold tracking-[-0.01em]">Manage plan</div>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-[color:var(--color-accent)]"
          >
            Done
          </button>
        </div>
        <div className="text-lg font-bold tracking-tight">{workout.title}</div>
        <div className="text-xs text-[color:var(--color-muted)] mt-0.5">
          {hint}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 pb-48">
        {/* Top "move here" slot (move to position 0). Visible when:
            - a block is solo-selected (tap flow), OR
            - a block is being dragged (drag flow) AND it's not already at top */}
        <MoveSlot
          visible={
            (soloSelectedIndex != null && soloSelectedIndex !== 0) ||
            (draggingIndex != null && draggingIndex !== 0)
          }
          isDragTarget={draggingIndex != null}
          onClick={() => moveTo(0)}
          onDrop={() => void dragMoveTo(0)}
        />

        {blocks.map((block) => {
          const isSelected = selectedIndices.includes(block.index);
          const selectionOrder = isSelected
            ? selectedIndices.indexOf(block.index) + 1
            : null;

          // "Move here" slot AFTER this block — visible in two cases:
          //   - tap flow: exactly ONE block selected and placing here changes order
          //   - drag flow: a block is dragging and placing here changes order
          const canBeTapMovedOver =
            soloSelectedIndex != null &&
            block.index !== soloSelectedIndex &&
            block.index !== soloSelectedIndex - 1;
          const canBeDragMovedOver =
            draggingIndex != null &&
            block.index !== draggingIndex &&
            block.index !== draggingIndex - 1;

          return (
            <div
              key={
                block.kind === "exercise"
                  ? `ex:${block.exerciseId}`
                  : `ss:${block.supersetGroupId}`
              }
            >
              <ManageBlockRow
                block={block}
                gifByExerciseId={gifByExerciseId}
                isSelected={isSelected}
                selectionOrder={selectionOrder}
                anyOtherSelected={
                  selectedIndices.length > 0 && !isSelected
                }
                isDragging={draggingIndex === block.index}
                anyDragging={draggingIndex != null}
                onSelect={() => toggleSelect(block.index)}
                onDragStart={() => setDraggingIndex(block.index)}
                onDragEnd={() => setDraggingIndex(null)}
                onEditTimer={(setIds, currentWork, currentRest, label) =>
                  setTimerEditor({
                    setIds,
                    work: currentWork,
                    rest: currentRest,
                    label,
                  })
                }
                onPatchSet={patchSet}
                onDuplicateSet={duplicateSet}
                onRemoveSet={removeSet}
              />
              <MoveSlot
                visible={canBeTapMovedOver || canBeDragMovedOver}
                isDragTarget={draggingIndex != null}
                onClick={() => {
                  if (soloSelectedIndex == null) return;
                  const targetIndex =
                    soloSelectedIndex > block.index
                      ? block.index + 1
                      : block.index;
                  void moveTo(targetIndex);
                }}
                onDrop={() => {
                  if (draggingIndex == null) return;
                  const targetIndex =
                    draggingIndex > block.index ? block.index + 1 : block.index;
                  void dragMoveTo(targetIndex);
                }}
              />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-4 w-full text-sm font-semibold text-[color:var(--color-accent)] border-2 border-dashed border-[color:var(--color-border)] rounded-xl py-4 hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/5"
        >
          + Add exercise
        </button>
      </div>

      {mode.kind === "selecting" && selectedBlocks.length > 0 && (
        <SelectionActionBar
          selectedBlocks={selectedBlocks}
          onSuperset={() => void supersetSelected()}
          onUnlink={() => {
            if (soloSelectedIndex == null) return;
            void doUnlink(soloSelectedIndex);
          }}
          onCancel={() => setMode({ kind: "idle" })}
        />
      )}

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          existingExerciseIds={new Set(workout.plannedSets.map((s) => s.exerciseId))}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {timerEditor && (
        <TimerEditor
          label={timerEditor.label}
          work={timerEditor.work}
          rest={timerEditor.rest}
          onSave={(w, r) => saveTimer(timerEditor.setIds, w, r)}
          onClear={() => clearTimer(timerEditor.setIds)}
          onClose={() => setTimerEditor(null)}
        />
      )}
    </div>
  );
}

function blockLabel(b: Block): string {
  return b.kind === "exercise"
    ? b.exerciseName
    : b.members.map((m) => m.exerciseName).join(" + ");
}

/** Thin drop target shown between blocks when exactly one block is selected,
 *  OR when a drag-reorder is in progress. Accepts tap (from selection flow)
 *  and drop (from drag flow) — they route to different handlers because the
 *  source index comes from state, not the event itself. */
function MoveSlot({
  visible,
  isDragTarget,
  onClick,
  onDrop,
}: {
  visible: boolean;
  isDragTarget: boolean;
  onClick: () => void;
  onDrop: () => void;
}) {
  const [isOver, setIsOver] = useState(false);
  if (!visible) return <div className="h-2" aria-hidden />;
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        // Must prevent default to accept drops.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDrop();
      }}
      className={`group my-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-[13px] font-medium transition-colors ${
        isOver
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/20"
          : "border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/[0.04]"
      } text-[color:var(--color-accent)]`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
      {isDragTarget ? "Drop here" : "Move here"}
    </button>
  );
}

function ManageBlockRow({
  block,
  gifByExerciseId,
  isSelected,
  selectionOrder,
  anyOtherSelected,
  isDragging,
  anyDragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onEditTimer,
  onPatchSet,
  onDuplicateSet,
  onRemoveSet,
}: {
  block: Block;
  gifByExerciseId: Map<string, string | undefined>;
  isSelected: boolean;
  selectionOrder: number | null;
  anyOtherSelected: boolean;
  isDragging: boolean;
  anyDragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEditTimer: (
    setIds: string[],
    work: number,
    rest: number,
    label: string
  ) => void;
  onPatchSet: (setId: string, patch: Partial<PlannedSet>) => void | Promise<void>;
  onDuplicateSet: (setId: string) => void | Promise<void>;
  onRemoveSet: (setId: string) => void | Promise<void>;
}) {
  const isSuperset = block.kind === "superset";

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

  const allSets = members.flatMap((m) => m.sets);
  const firstWithTimer = allSets.find((s) => s.workSeconds != null);
  const currentWork = firstWithTimer?.workSeconds ?? 45;
  const currentRest = firstWithTimer?.restSeconds ?? 15;
  const timerEnabled = !!firstWithTimer;
  const setIds = allSets.map((s) => s.id);
  const label = blockLabel(block);

  const baseBorder = isSuperset
    ? "border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/[0.04]"
    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]";

  const ringClasses = isSelected
    ? "ring-2 ring-[color:var(--color-accent)] border-[color:var(--color-accent)]"
    : "";

  const dimmed =
    (anyOtherSelected && !isSelected) || (anyDragging && !isDragging)
      ? "opacity-50"
      : "";
  const draggingClasses = isDragging
    ? "opacity-30 ring-2 ring-[color:var(--color-accent)]/60"
    : "";

  return (
    <div
      className={`rounded-[14px] border transition-colors ${baseBorder} ${ringClasses} ${dimmed} ${draggingClasses}`}
      draggable
      onDragStart={(e) => {
        // Needed for Firefox to actually fire drag events.
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", String(block.index));
        } catch {
          // Safari private mode can throw — safe to ignore.
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      {/* Tappable header — uses a div so we can nest inputs below. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="flex cursor-pointer items-center gap-3 p-3"
      >
        {/* Drag handle — grip icon. The whole row is draggable, but the handle
            is a visual affordance so the user knows reorder-by-drag exists. */}
        <div
          className="shrink-0 text-[color:var(--color-muted-2)] hover:text-white cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
            <circle cx="3.5" cy="3" r="1.3" />
            <circle cx="10.5" cy="3" r="1.3" />
            <circle cx="3.5" cy="9" r="1.3" />
            <circle cx="10.5" cy="9" r="1.3" />
            <circle cx="3.5" cy="15" r="1.3" />
            <circle cx="10.5" cy="15" r="1.3" />
          </svg>
        </div>

        {/* Selection checkbox / order badge */}
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium tnum transition-colors ${
            isSelected
              ? "bg-[color:var(--color-accent)] text-white"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted-2)]"
          }`}
          aria-hidden
        >
          {isSelected ? selectionOrder ?? "✓" : ""}
        </div>

        {/* Thumbnails */}
        <div className={`flex ${isSuperset ? "gap-1" : ""} shrink-0`}>
          {members.slice(0, 2).map((m) => (
            <div key={m.exerciseId} className="size-12 rounded-lg overflow-hidden">
              <ExerciseGif
                name={m.exerciseName}
                gifUrl={gifByExerciseId.get(m.exerciseId)}
                size="thumb"
              />
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {isSuperset && (
            <div className="text-[12px] font-medium text-[color:var(--color-accent)]">
              Superset
            </div>
          )}
          <div className="truncate text-[16px] tracking-[-0.01em]">{label}</div>
          <div className="mt-0.5 text-[13px] tnum text-[color:var(--color-muted)]">
            {allSets.length} set{allSets.length === 1 ? "" : "s"}
            {timerEnabled && (
              <>
                {" · "}
                <span className="text-[color:var(--color-accent)]">
                  ⏱ {formatDur(currentWork)} / {formatDur(currentRest)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Timer pill — independent tap target */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onEditTimer(setIds, currentWork, currentRest, label);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onEditTimer(setIds, currentWork, currentRest, label);
            }
          }}
          className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
            timerEnabled
              ? "bg-[color:var(--color-accent)] text-white"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
          }`}
        >
          {timerEnabled ? "Timer" : "Add timer"}
        </span>
      </div>

      {/* Inline expand: edit sets directly when selected */}
      {isSelected && (
        <div className="border-t border-[color:var(--color-border)] px-3 pt-2 pb-3 space-y-2">
          {members.map((m) => (
            <div key={m.exerciseId}>
              {members.length > 1 && (
                <div className="px-1 pb-1 text-[13px] text-[color:var(--color-muted)]">
                  {m.exerciseName}
                </div>
              )}
              <div className="space-y-1.5">
                {m.sets.map((s, i) => (
                  <SetMiniRow
                    key={s.id}
                    set={s}
                    index={i + 1}
                    onPatch={(p) => void onPatchSet(s.id, p)}
                    onDuplicate={() => void onDuplicateSet(s.id)}
                    onRemove={() => void onRemoveSet(s.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SET_TYPES: SetType[] = ["Working", "Warm-up", "PT/Rehab", "Stretch", "Drop"];

/** One editable row per set — reps, weight, set type, actions. */
function SetMiniRow({
  set,
  index,
  onPatch,
  onDuplicate,
  onRemove,
}: {
  set: PlannedSet;
  index: number;
  onPatch: (patch: Partial<PlannedSet>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const done = set.completedAt != null;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 bg-[color:var(--color-surface-2)]/60 ${
        done ? "opacity-60" : ""
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="shrink-0 w-5 text-[11px] font-bold text-[color:var(--color-muted-2)] tabular-nums">
        {index}
      </span>
      {/* Reps — or minutes, when the set is measured on a clock. */}
      {set.workSeconds != null ? (
        <label className="flex min-w-0 items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={Math.round(set.workSeconds / 60)}
            onChange={(e) =>
              onPatch({
                workSeconds: Math.max(0, Number(e.target.value) || 0) * 60,
              })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-14 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-1 text-center text-sm tnum"
          />
          <span className="text-[10px] text-[color:var(--color-muted-2)]">min</span>
        </label>
      ) : (
        <label className="flex min-w-0 items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={set.targetReps}
            onChange={(e) =>
              onPatch({ targetReps: Math.max(0, Number(e.target.value) || 0) })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-14 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-1 text-center text-sm tnum"
          />
          <span className="text-[10px] text-[color:var(--color-muted-2)]">reps</span>
        </label>
      )}
      {/* Weight */}
      <label className="flex items-center gap-1 min-w-0">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={set.targetWeight ?? ""}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value.trim();
            onPatch({ targetWeight: v === "" ? undefined : Number(v) });
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-16 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded px-1.5 py-1 text-sm tabular-nums text-center"
        />
        <span className="text-[10px] text-[color:var(--color-muted-2)] uppercase">lb</span>
      </label>
      {/* Set type */}
      <select
        value={set.setType}
        onChange={(e) => onPatch({ setType: e.target.value as SetType })}
        onClick={(e) => e.stopPropagation()}
        className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded px-1.5 py-1 text-xs font-semibold min-w-0"
        title="Set type"
      >
        {SET_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <div className="flex-1" />
      {/* Duplicate */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="shrink-0 size-7 rounded-md bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center"
        title="Duplicate set"
        aria-label="Duplicate set"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </button>
      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm("Delete this set?")) onRemove();
        }}
        className="shrink-0 size-7 rounded-md bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] hover:border-[color:var(--color-danger)] flex items-center justify-center"
        title="Delete set"
        aria-label="Delete set"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </div>
  );
}

/** Sticky bottom bar while blocks are selected. */
function SelectionActionBar({
  selectedBlocks,
  onSuperset,
  onUnlink,
  onCancel,
}: {
  selectedBlocks: Block[];
  onSuperset: () => void;
  onUnlink: () => void;
  onCancel: () => void;
}) {
  const count = selectedBlocks.length;
  const solo = count === 1 ? selectedBlocks[0] : null;
  const soloIsSuperset = solo?.kind === "superset";
  const label =
    count === 1
      ? blockLabel(selectedBlocks[0])
      : selectedBlocks.map(blockLabel).join(" + ");

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 backdrop-blur px-4 pt-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mb-1 text-[13px] text-[color:var(--color-muted)]">
        {count === 1 ? "Selected" : `Selected · ${count}`}
      </div>
      <div className="mb-3 truncate text-[16px] font-semibold tracking-[-0.01em]">
        {label}
      </div>
      <div className="flex items-center gap-2">
        {count >= 2 && (
          <button
            onClick={onSuperset}
            className="flex-1 h-11 rounded-full bg-[color:var(--color-accent)] text-white font-semibold text-sm"
          >
            Superset ({count})
          </button>
        )}
        {count === 1 && !soloIsSuperset && (
          <div className="flex-1 text-[11px] text-[color:var(--color-muted)] text-center leading-tight">
            Tap another exercise to superset,
            <br />
            or tap a "Move here" slot
          </div>
        )}
        {count === 1 && soloIsSuperset && (
          <button
            onClick={onUnlink}
            className="flex-1 h-11 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[color:var(--color-muted)] font-semibold text-sm hover:text-white"
          >
            Unlink superset
          </button>
        )}
        <button
          onClick={onCancel}
          className="h-11 px-5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[color:var(--color-muted)] font-semibold text-sm hover:text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** Pretty-print a duration in seconds: "45s" or "3m" or "3m 30s". */
function formatDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** Break a total seconds value into (min, sec) for two-field editing. */
function toMinSec(total: number): { min: number; sec: number } {
  const t = Math.max(0, Math.round(total));
  return { min: Math.floor(t / 60), sec: t % 60 };
}

/**
 * Bottom-sheet editor for a block's timer.
 * Two fields per phase (min + sec) so long durations (3 min, 30 min) are easy.
 */
function TimerEditor({
  label,
  work,
  rest,
  onSave,
  onClear,
  onClose,
}: {
  label: string;
  work: number;
  rest: number;
  onSave: (work: number, rest: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const workInit = toMinSec(work);
  const restInit = toMinSec(rest);
  const [wm, setWm] = useState(workInit.min);
  const [ws, setWs] = useState(workInit.sec);
  const [rm, setRm] = useState(restInit.min);
  const [rs, setRs] = useState(restInit.sec);

  const totalWork = wm * 60 + ws;
  const totalRest = rm * 60 + rs;

  const presets: { label: string; work: number; rest: number }[] = [
    { label: "45s / 15s", work: 45, rest: 15 },
    { label: "60s / 15s", work: 60, rest: 15 },
    { label: "90s / 30s", work: 90, rest: 30 },
    { label: "3 min / 60s", work: 180, rest: 60 },
    { label: "5 min / 60s", work: 300, rest: 60 },
    { label: "30 min / 30s", work: 1800, rest: 30 },
  ];

  function applyPreset(p: { work: number; rest: number }) {
    const w = toMinSec(p.work);
    const r = toMinSec(p.rest);
    setWm(w.min);
    setWs(w.sec);
    setRm(r.min);
    setRs(r.sec);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
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
        <div className="flex items-center justify-between mb-1">
          <div className="text-[17px] font-semibold tracking-[-0.01em]">Timer</div>
          <button
            onClick={onClose}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Cancel
          </button>
        </div>
        <div className="text-base font-bold tracking-tight truncate">{label}</div>
        <p className="text-xs text-[color:var(--color-muted)] mt-1 mb-4">
          A ▶ button appears on every set. Work → rest → done. Use min + sec for
          long holds like 3 min carries or 30 min cardio.
        </p>

        <div className="space-y-3 mb-4">
          <DurationField
            heading="Work"
            min={wm}
            sec={ws}
            onMinChange={setWm}
            onSecChange={setWs}
            totalLabel={formatDur(totalWork)}
          />
          <DurationField
            heading="Rest"
            min={rm}
            sec={rs}
            onMinChange={setRm}
            onSecChange={setRs}
            totalLabel={formatDur(totalRest)}
            allowZero
          />
        </div>

        <div className="mb-2 text-[15px] font-semibold tracking-[-0.01em]">Presets</div>
        <div className="flex flex-wrap gap-2 mb-6">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] text-xs font-semibold text-[color:var(--color-muted)] hover:text-white"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="flex-1 rounded-full border border-[color:var(--color-border)] text-[color:var(--color-muted)] font-semibold py-3 hover:text-[color:var(--color-danger)] hover:border-[color:var(--color-danger)]"
          >
            Remove timer
          </button>
          <button
            onClick={() => onSave(Math.max(0, totalWork), Math.max(0, totalRest))}
            disabled={totalWork <= 0}
            className="flex-1 rounded-full bg-[color:var(--color-accent)] text-white font-semibold py-3 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DurationField({
  heading,
  min,
  sec,
  onMinChange,
  onSecChange,
  totalLabel,
  allowZero = false,
}: {
  heading: string;
  min: number;
  sec: number;
  onMinChange: (n: number) => void;
  onSecChange: (n: number) => void;
  totalLabel: string;
  allowZero?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[13px] text-[color:var(--color-muted)]">{heading}</span>
        <span className="text-[13px] tnum text-[color:var(--color-muted-2)]">
          {totalLabel}
          {!allowZero && min === 0 && sec === 0 && (
            <span className="text-[color:var(--color-danger)] ml-1">· set a duration</span>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={min}
            onChange={(e) => onMinChange(Math.max(0, Number(e.target.value) || 0))}
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] pl-3.5 pr-11 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[color:var(--color-muted-2)]">
            min
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={sec}
            onChange={(e) => {
              const n = Math.max(0, Math.min(59, Number(e.target.value) || 0));
              onSecChange(n);
            }}
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] pl-3.5 pr-11 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[color:var(--color-muted-2)]">
            sec
          </span>
        </div>
      </div>
    </div>
  );
}
