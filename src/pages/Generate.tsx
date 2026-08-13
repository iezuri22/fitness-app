import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createWorkout, listExercises } from "../lib/db";
import {
  Button,
  Card,
  Group,
  PageHeader,
  PageSkeleton,
  Row,
  Segmented,
} from "../components/ui";
import ExerciseGif from "../components/ExerciseGif";
import { todayStr } from "../lib/dates";
import { estimatePlannedMinutes } from "../lib/timeEstimate";
import {
  BODY_PARTS,
  LENGTHS,
  generateWorkout,
  type BodyPart,
  type GeneratedWorkout,
  type Length,
  type Location,
} from "../lib/generateWorkout";
import type { Exercise } from "../lib/types";

/**
 * Build-a-workout screen — pick body parts, where you are, and how long you've
 * got; the app assembles a session from your own exercise library.
 *
 * Regenerating bumps a seed so you get a different-but-sensible mix rather than
 * the same list every time. Starting it creates a normal Workout doc, so it
 * runs and logs exactly like a template-based session.
 *
 * `?date=YYYY-MM-DD` (from the week planner) schedules it for that day instead
 * of starting it now.
 */
export default function Generate() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const planDate = searchParams.get("date");

  const [library, setLibrary] = useState<Exercise[] | null>(null);
  const [parts, setParts] = useState<BodyPart[]>([]);
  const [location, setLocation] = useState<Location>("gym");
  const [length, setLength] = useState<Length>("medium");
  const [seed, setSeed] = useState(0);
  const [preview, setPreview] = useState<GeneratedWorkout | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const ex = await listExercises(user.uid);
      if (alive) setLibrary(ex);
    })();
    return () => { alive = false; };
  }, [user]);

  const gifByExerciseId = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const ex of library ?? []) m.set(ex.id, ex.gifUrl);
    return m;
  }, [library]);

  function build(nextSeed = seed) {
    if (!library) return;
    setPreview(generateWorkout(library, { parts, location, length, seed: nextSeed }));
  }

  function toggle(part: BodyPart) {
    setPreview(null);
    setParts((p) => (p.includes(part) ? p.filter((x) => x !== part) : [...p, part]));
  }

  async function start() {
    if (!user || !preview || starting) return;
    setStarting(true);
    try {
      const id = await createWorkout(user.uid, {
        date: planDate ?? todayStr(),
        slot: "strength",
        title: preview.title,
        focus: preview.focus,
        status: "planned",
        plannedSets: preview.plannedSets,
        category: "Full",
        notes: "Generated workout.",
      });
      nav(planDate ? "/plan" : `/workout/${id}`);
    } catch (e) {
      console.error("[Generate] start failed:", e);
      setStarting(false);
    }
  }

  if (library === null) return <PageSkeleton rows={5} />;

  const previewMinutes = preview ? estimatePlannedMinutes(preview) : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Generate"
        subtitle={planDate ? "Schedule a session" : "Build a session"}
        action={
          <Link
            to={planDate ? "/plan" : "/library"}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Cancel
          </Link>
        }
      />

      {/* Body parts */}
      <section className="space-y-2">
        <SectionLabel>Focus on</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {BODY_PARTS.map((b) => {
            const on = parts.includes(b.key);
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => toggle(b.key)}
                className={`rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors ${
                  on
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Where */}
      <section className="space-y-2">
        <SectionLabel>Where</SectionLabel>
        <Segmented
          value={location}
          onChange={(l) => { setLocation(l); setPreview(null); }}
          options={[
            { value: "gym" as Location, label: "Gym" },
            { value: "home" as Location, label: "Home" },
          ]}
        />
      </section>

      {/* How long */}
      <section className="space-y-2">
        <SectionLabel>How long</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {LENGTHS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => { setLength(l.key); setPreview(null); }}
              className={`rounded-[12px] py-3 text-center transition-colors ${
                length === l.key
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
              }`}
            >
              <div className="text-[15px] font-medium">{l.label}</div>
              <div className={`text-[13px] tnum ${length === l.key ? "text-white/70" : "opacity-60"}`}>
                ~{l.minutes} min
              </div>
            </button>
          ))}
        </div>
      </section>

      {parts.length === 0 ? (
        <p className="py-4 text-center text-[15px] text-[color:var(--color-muted-2)]">
          Pick at least one body part to focus on.
        </p>
      ) : !preview ? (
        <Button size="lg" block onClick={() => build()}>
          Generate workout
        </Button>
      ) : (
        <>
          {/* Preview */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
                  {preview.title}
                </div>
                <div className="mt-0.5 text-[13px] tnum text-[color:var(--color-muted)]">
                  {preview.exerciseCount} exercises · {preview.plannedSets.length} sets
                </div>
              </div>
              <div className="shrink-0 text-[15px] tnum text-[color:var(--color-muted)]">
                {Math.round(previewMinutes)} min
              </div>
            </div>

            {preview.unmatched.length > 0 && (
              <div className="mt-3 text-[13px] text-[color:var(--color-warn)]">
                Nothing in your library for{" "}
                {preview.unmatched
                  .map((p) => BODY_PARTS.find((b) => b.key === p)?.label ?? p)
                  .join(", ")}
                {location === "home" ? " at home" : ""} — skipped.
              </div>
            )}
          </Card>

          {/* Exercise list */}
          <Group>
            {dedupeByExercise(preview).map((row) => (
              <Row
                key={row.exerciseId}
                leading={
                  <ExerciseGif
                    name={row.exerciseName}
                    gifUrl={gifByExerciseId.get(row.exerciseId)}
                    size="mini"
                  />
                }
                title={row.exerciseName}
                value={row.isWarmup ? `${row.reps} min` : `${row.sets} × ${row.reps}`}
              />
            ))}
          </Group>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { const s = seed + 1; setSeed(s); build(s); }}
            >
              Shuffle
            </Button>
            <Button className="flex-1" onClick={start} disabled={starting}>
              {starting ? "Starting…" : planDate ? "Schedule it" : "Start workout"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>
  );
}

/** Collapse the flat set list into one row per exercise for the preview. */
function dedupeByExercise(g: GeneratedWorkout) {
  const rows: { exerciseId: string; exerciseName: string; sets: number; reps: number; isWarmup: boolean }[] = [];
  for (const s of g.plannedSets) {
    const existing = rows.find((r) => r.exerciseId === s.exerciseId);
    if (existing) existing.sets++;
    else
      rows.push({
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        sets: 1,
        reps: s.targetReps,
        isWarmup: s.setType === "Warm-up",
      });
  }
  return rows;
}
