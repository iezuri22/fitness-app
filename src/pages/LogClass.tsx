import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createWorkout } from "../lib/db";
import { Button, Input, PageHeader } from "../components/ui";
import { todayStr } from "../lib/dates";
import type { PlannedSet } from "../lib/types";

/**
 * Log a class you took — HIIT, spin, yoga, whatever. Plans change; this is the
 * escape hatch that keeps the record honest instead of leaving a planned
 * workout sitting there unfinished.
 *
 * Saved as a completed Workout so it counts toward weekly goals and shows in
 * History. Exercises are optional free text: most people remember "we did
 * burpees and wall balls", not sets and reps, and forcing structure here would
 * mean it just doesn't get logged.
 */
const CLASS_TYPES = [
  { key: "HIIT", label: "HIIT", mins: 45 },
  { key: "Spin", label: "Spin", mins: 45 },
  { key: "Yoga", label: "Yoga", mins: 60 },
  { key: "Pilates", label: "Pilates", mins: 50 },
  { key: "Bootcamp", label: "Bootcamp", mins: 60 },
  { key: "CrossFit", label: "CrossFit", mins: 60 },
  { key: "Strength", label: "Strength", mins: 60 },
  { key: "Other", label: "Other", mins: 45 },
];

export default function LogClass() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [type, setType] = useState("HIIT");
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [date, setDate] = useState(params.get("date") ?? todayStr());
  const [effort, setEffort] = useState(7);
  const [what, setWhat] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function pickType(key: string) {
    setType(key);
    const t = CLASS_TYPES.find((c) => c.key === key);
    if (t) setMinutes(t.mins);
  }

  async function save() {
    if (!user || saving) return;
    setSaving(true);
    try {
      // One synthetic set carries the duration so the class shows a sensible
      // time everywhere the app estimates workout length.
      const sets: PlannedSet[] = [
        {
          id: crypto.randomUUID(),
          exerciseId: "class",
          exerciseName: what.trim() || `${type} class`,
          order: 1,
          targetReps: minutes,
          setType: "Working",
          restSeconds: 0,
          estimatedMinutes: minutes,
          completedAt: Date.now(),
          userNotes: what.trim() || undefined,
        },
      ];
      const title = name.trim() || `${type} Class`;
      await createWorkout(user.uid, {
        date,
        slot: "strength",
        title,
        focus: `${type} Class · ${minutes} min`,
        status: "completed",
        plannedSets: sets,
        category: "Full",
        notes:
          [what.trim() && `What we did: ${what.trim()}`, notes.trim(), `Effort: ${effort}/10`]
            .filter(Boolean)
            .join("\n") || undefined,
        startedAt: Date.now() - minutes * 60_000,
        completedAt: Date.now(),
      });
      nav("/plan");
    } catch (e) {
      console.error("[LogClass] save failed:", e);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Log a class"
        subtitle="Something you already did"
        action={
          <Link
            to="/plan"
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Cancel
          </Link>
        }
      />

      <section className="space-y-2">
        <SectionLabel>Type</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {CLASS_TYPES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => pickType(c.key)}
              className={`rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors ${
                type === c.key
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <Input
        label="Class name (optional)"
        placeholder={`e.g. "Barry's Bootcamp" or "6am HIIT"`}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-[13px] text-[color:var(--color-muted)]">
            Minutes
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(5, Number(e.target.value) || 0))}
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] tnum outline-none focus:bg-[color:var(--color-surface-3)]"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] text-[color:var(--color-muted)]">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayStr())}
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] outline-none focus:bg-[color:var(--color-surface-3)]"
          />
        </label>
      </div>

      <section className="space-y-2">
        <SectionLabel>How hard was it — {effort}/10</SectionLabel>
        <input
          type="range"
          min={1}
          max={10}
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          className="w-full accent-[color:var(--color-accent)]"
        />
        <div className="flex justify-between text-[13px] text-[color:var(--color-muted-2)]">
          <span>Easy</span>
          <span>All out</span>
        </div>
      </section>

      <label className="block space-y-1.5">
        <span className="text-[13px] text-[color:var(--color-muted)]">
          What did you do?
        </span>
        <textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          rows={4}
          placeholder="Burpees, wall balls, rowing intervals, 3 rounds…"
          className="w-full resize-none rounded-xl bg-[color:var(--color-surface-2)] px-3.5 py-3 text-[16px] outline-none placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-[13px] text-[color:var(--color-muted)]">
          How did it feel? (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Shoulder felt fine, legs cooked…"
          className="w-full resize-none rounded-xl bg-[color:var(--color-surface-2)] px-3.5 py-3 text-[16px] outline-none placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)]"
        />
      </label>

      <Button size="lg" block onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Log it"}
      </Button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>
  );
}
