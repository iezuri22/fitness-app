import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createWorkout, listExercises } from "../lib/db";
import { Button, Card, Input, Tag } from "../components/ui";
import ExerciseGif from "../components/ExerciseGif";
import type { Exercise, ExerciseCategory, PlannedSet, SetType } from "../lib/types";
import { defaultEstimatedMinutes } from "../lib/duration";
import { todayStr } from "../lib/dates";

interface Draft {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  targetReps: number;
  targetWeight?: number;
  setType: SetType;
  restSeconds: number;
}

export default function NewWorkout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("Upper Body");
  const [date, setDate] = useState(todayStr());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listExercises(user.uid).then(setExercises);
  }, [user]);

  // Auto-suggest a title from focus when title is empty
  useEffect(() => {
    if (!title.trim()) setTitle(`${focus} + Shoulder Rehab`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const totalSets = useMemo(() => drafts.reduce((s, d) => s + d.sets, 0), [drafts]);
  const draftIds = useMemo(() => new Set(drafts.map((d) => d.exerciseId)), [drafts]);

  function addDraft(e: Exercise) {
    setDrafts((d) => [
      ...d,
      {
        exerciseId: e.id,
        exerciseName: e.name,
        sets: 3,
        targetReps: e.defaultReps ?? 10,
        targetWeight: e.defaultWeight,
        setType: e.isPT ? "PT/Rehab" : "Working",
        restSeconds: e.isPT ? 30 : 60,
      },
    ]);
    setPicking(false);
  }

  function updateDraft(i: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function removeDraft(i: number) {
    setDrafts((d) => d.filter((_, idx) => idx !== i));
  }

  function moveDraft(i: number, dir: -1 | 1) {
    setDrafts((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    if (!user) return;
    if (drafts.length === 0) return;
    if (totalSets > 20) {
      if (!confirm(`${totalSets} sets is over the recommended cap of 20. Save anyway?`))
        return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const plannedSets: PlannedSet[] = [];
      let order = 0;
      for (const d of drafts) {
        for (let i = 0; i < d.sets; i++) {
          // Strip undefined fields explicitly — defense in depth even though
          // Firestore is now configured to ignore undefineds.
          const set: PlannedSet = {
            id: crypto.randomUUID(),
            exerciseId: d.exerciseId,
            exerciseName: d.exerciseName,
            order: order++,
            targetReps: d.targetReps,
            setType: d.setType,
            estimatedMinutes: defaultEstimatedMinutes(d.exerciseName),
          };
          if (d.targetWeight && d.targetWeight > 0) set.targetWeight = d.targetWeight;
          if (d.restSeconds > 0) set.restSeconds = d.restSeconds;
          plannedSets.push(set);
        }
      }
      await createWorkout(user.uid, {
        date,
        title: title.trim() || `${focus} + Shoulder Rehab`,
        focus,
        status: "planned",
        plannedSets,
      });
      // Land back on Today so the user can hit Start.
      nav("/", { replace: true });
    } catch (e: unknown) {
      console.error("[NewWorkout] save failed:", e);
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-sm text-[color:var(--color-muted)]">
          ← Today
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Plan workout</h1>

      <div className="space-y-3">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Focus" value={focus} onChange={(e) => setFocus(e.target.value)} />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Exercises</span>
          <span
            className={`text-[13px] tnum text-[color:var(--color-muted)] ${
              totalSets > 20 ? "text-[color:var(--color-warn)]" : ""
            }`}
          >
            {totalSets} / 20 sets
          </span>
        </div>

        {drafts.length === 0 ? (
          <Card className="py-8 text-center text-[15px] text-[color:var(--color-muted)]">
            No exercises yet. Tap below to add one.
          </Card>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d, i) => (
              <li key={`${d.exerciseId}-${i}`}>
                <Card className="!p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <ExerciseGif name={d.exerciseName} size="thumb" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{d.exerciseName}</div>
                      <div className="text-[13px] text-[color:var(--color-muted)]">
                        {d.setType}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => moveDraft(i, -1)}
                        disabled={i === 0}
                        className="size-6 rounded grid place-items-center text-[color:var(--color-muted)] hover:text-white disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDraft(i, 1)}
                        disabled={i === drafts.length - 1}
                        className="size-6 rounded grid place-items-center text-[color:var(--color-muted)] hover:text-white disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => removeDraft(i)}
                      className="text-[color:var(--color-danger)] hover:brightness-125 shrink-0 px-2"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <NumberField
                      label="Sets"
                      value={d.sets}
                      onChange={(v) => updateDraft(i, { sets: Math.max(1, v) })}
                    />
                    <NumberField
                      label="Reps"
                      value={d.targetReps}
                      onChange={(v) => updateDraft(i, { targetReps: Math.max(1, v) })}
                    />
                    <NumberField
                      label="Weight"
                      value={d.targetWeight ?? 0}
                      onChange={(v) => updateDraft(i, { targetWeight: v || undefined })}
                      suffix="lb"
                    />
                    <NumberField
                      label="Rest"
                      value={d.restSeconds}
                      onChange={(v) => updateDraft(i, { restSeconds: Math.max(0, v) })}
                      suffix="s"
                    />
                  </div>
                  <label className="block">
                    <select
                      value={d.setType}
                      onChange={(e) => updateDraft(i, { setType: e.target.value as SetType })}
                      className="w-full rounded-xl bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]"
                    >
                      <option>Working</option>
                      <option>Warm-up</option>
                      <option>PT/Rehab</option>
                      <option>Stretch</option>
                      <option>Drop</option>
                    </select>
                  </label>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="secondary"
          className="w-full mt-3"
          onClick={() => setPicking(true)}
        >
          + Add exercise
        </Button>
      </div>

      {saveError && (
        <Card className="border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/[0.06]">
          <div className="text-sm font-semibold text-[color:var(--color-danger)]">
            Save failed
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-muted)] break-words">
            {saveError}
          </div>
        </Card>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={save}
        disabled={saving || drafts.length === 0}
      >
        {saving ? "Saving…" : "Save workout"}
      </Button>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          alreadyAdded={draftIds}
          onClose={() => setPicking(false)}
          onPick={addDraft}
        />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase text-[color:var(--color-muted-2)] font-semibold tracking-wide">
        {label}
        {suffix && <span className="ml-0.5 normal-case">({suffix})</span>}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-[color:var(--color-accent)]"
      />
    </label>
  );
}

const PICKER_CATEGORIES: (ExerciseCategory | "All")[] = [
  "All",
  "PT/Rehab",
  "Upper Body",
  "Lower Body",
  "Core",
  "Full Body",
  "Mobility",
];

function ExercisePicker({
  exercises,
  alreadyAdded,
  onClose,
  onPick,
}: {
  exercises: Exercise[];
  alreadyAdded: Set<string>;
  onClose: () => void;
  onPick: (e: Exercise) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExerciseCategory | "All">("All");

  // Lock body scroll + close on Escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return exercises.filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (ql && !e.name.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [exercises, q, cat]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close picker"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-bg"
      />

      {/* Sheet */}
      <div
        className="animate-slide-up-sheet relative flex h-[88vh] w-full max-w-xl flex-col rounded-t-[16px] bg-[color:var(--color-surface)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-5 pt-3 pb-4 border-b border-[color:var(--color-border)]">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[color:var(--color-muted-2)]" />
          <div className="flex items-center justify-between mb-3">
            <div className="text-[17px] font-semibold tracking-[-0.01em]">Pick an exercise</div>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-[color:var(--color-muted)] hover:text-white"
            >
              Done
            </button>
          </div>
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex gap-2 overflow-x-auto pt-3 -mx-5 px-5">
            {PICKER_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  cat === c
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <ul className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {filtered.length === 0 && (
            <li className="py-12 text-center text-sm text-[color:var(--color-muted)]">
              No exercises match.
            </li>
          )}
          {filtered.map((e) => {
            const added = alreadyAdded.has(e.id);
            return (
              <li key={e.id}>
                <button
                  onClick={() => onPick(e)}
                  className={`flex w-full items-center gap-3 rounded-[12px] p-2.5 text-left transition-colors ${
                    added
                      ? "bg-[color:var(--color-accent-soft)]"
                      : "active:bg-[color:var(--color-surface-2)]"
                  }`}
                >
                  <ExerciseGif name={e.name} gifUrl={e.gifUrl} size="thumb" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-[16px]">
                      <span className="truncate">{e.name}</span>
                      {added && (
                        <span className="shrink-0 text-[13px] text-[color:var(--color-accent)]">
                          Added
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-[color:var(--color-muted)]">
                      {e.category}
                      {e.equipment.length > 0 && ` · ${e.equipment.join(", ")}`}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    {e.isPT && <Tag variant="accent">PT</Tag>}
                    {e.isBannedLatarjet && <Tag variant="danger">Banned</Tag>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <style>{`
        @keyframes _picker_fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes _picker_slide { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-fade-bg { animation: _picker_fade 200ms ease-out forwards; }
        .animate-slide-up-sheet { animation: _picker_slide 280ms cubic-bezier(0.32, 0.72, 0, 1) forwards; }
      `}</style>
    </div>
  );
}
