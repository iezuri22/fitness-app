import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  createTemplate,
  deleteTemplate,
  deleteWorkout,
  getWorkout,
  importMissingNotionExercises,
  listExercises,
  listTemplates,
  recordTrainingSignal,
  saveTemplate,
  startWorkoutFromTemplate,
  type TemplatePatch,
} from "../lib/db";
import {
  Button,
  Card,
  EmptyState,
  Group,
  PageHeader,
  PageSkeleton,
  Row,
  SectionHeader,
  Segmented,
  Sheet,
  SheetHeader,
} from "../components/ui";
import {
  BODY_PARTS,
  exerciseLocation,
  type BodyPart,
  type ExerciseLocation,
} from "../lib/generateWorkout";
import { templateLoad } from "../lib/recommend";
import { signalFor } from "../lib/trainingSignals";
import ManagePlanSheet from "../components/ManagePlanSheet";
import TemplateDetailsSheet from "../components/TemplateDetailsSheet";
import {
  countMissingStarterTemplates,
  findRetiredTemplates,
  resolveStarterTemplates,
} from "../lib/starterTemplates";
import { findGifForName } from "../lib/exerciseGifs";
import { estimatePlannedMinutes } from "../lib/timeEstimate";
import type {
  Exercise,
  PlannedSet,
  TemplateCategory,
  Workout,
  WorkoutTemplate,
} from "../lib/types";

type SlotPick = "morning-stretch" | "morning-pt" | "strength";
type TabKey = "pt" | "strength";
type DurationKey = "any" | "short" | "medium" | "long";
type KindKey = "any" | "benchmark" | "guided" | "standard";
type WhenKey = "any" | "morning" | "evening";

/**
 * Time-of-day, read off the naming convention the starter pack uses ("AM · …",
 * "PM · …") with a fallback to the focus text, so hand-made routines named
 * "Morning mobility" are still found.
 */
const WHENS: { key: WhenKey; label: string; sub: string }[] = [
  { key: "any", label: "Any time", sub: "" },
  { key: "morning", label: "Morning", sub: "wake-up and pre-gym routines" },
  { key: "evening", label: "Evening", sub: "wind-down and night routines" },
];

function whenOf(t: WorkoutTemplate): WhenKey {
  const hay = `${t.name} ${t.focus}`.toLowerCase();
  if (/^am ·|\bam ·|morning|wake.?up|pre.?gym/.test(hay)) return "morning";
  if (/^pm ·|\bpm ·|evening|wind.?down|night|bed/.test(hay)) return "evening";
  return "any";
}

/**
 * How a workout runs, phrased for someone who's never seen "AMRAP" before.
 * The acronym is spelled out everywhere it appears in chrome; template names
 * keep it because they're scored history anchors and renaming them would
 * orphan past results.
 */
const KINDS: { key: KindKey; label: string; sub: string }[] = [
  { key: "any", label: "All types", sub: "" },
  { key: "benchmark", label: "Benchmarks", sub: "as many rounds as possible, against the clock" },
  { key: "guided", label: "Guided flows", sub: "timed holds, paced for you" },
  { key: "standard", label: "Standard", sub: "work through the sets" },
];

/**
 * Where a workout can be done. Home-friendly means *every* movement in it
 * works without gym equipment — one cable fly makes the whole session a gym
 * session, which is the answer you need when deciding what to do tonight.
 *
 * Only the exercise name is available on a template's sets, so equipment is
 * inferred from that; it's the same rule the generator uses.
 */
function locationOf(t: WorkoutTemplate): ExerciseLocation {
  const sets = t.plannedSets ?? [];
  if (!sets.length) return "home";
  return sets.some((s) => exerciseLocation({ name: s.exerciseName }) === "gym")
    ? "gym"
    : "home";
}

function formatOf(t: WorkoutTemplate): KindKey {
  if (t.format === "amrap") return "benchmark";
  if (t.format === "flow") return "guided";
  return "standard";
}

/** Duration bands for the filter chips. Ranges are [min, max) in minutes. */
const DURATIONS: { key: DurationKey; label: string; sub: string; min: number; max: number }[] = [
  { key: "any", label: "Any", sub: "", min: 0, max: Infinity },
  { key: "short", label: "Short", sub: "< 25m", min: 0, max: 25 },
  { key: "medium", label: "Medium", sub: "25–45m", min: 25, max: 45 },
  { key: "long", label: "Long", sub: "45m +", min: 45, max: Infinity },
];

/**
 * Library — browse / pick templates.
 *
 * Browse mode: header, category segmented control (PT / Strength), search +
 * duration filter chips, then full-width cards grouped by focus area. When a
 * search or duration filter is active the grouping collapses into one flat
 * result list. A collapsed Manage section at the bottom hosts power-user
 * actions (rename, archive, delete, seed starter pack, duplicate, category).
 *
 * Pick mode has two flavours:
 *   - `?pick=morning-pt|strength` (from Today's empty slot) locks the category
 *     tab and starts the workout for today. `?replace=<workoutId>` also drops
 *     the previous pick so a slot never accumulates orphan docs.
 *   - `?date=YYYY-MM-DD` (from the week planner) leaves both tabs available
 *     and schedules the workout for that day, then returns to /plan.
 *
 * Focus bucketing is keyword-matched on `template.focus` — unmatched focus
 * strings fall into "Other". Keep BUCKETS order in the intended render order.
 */
export default function Library() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [templates, setTemplates] = useState<WorkoutTemplate[] | undefined>(undefined);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [editingDetails, setEditingDetails] = useState<WorkoutTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("strength");
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState<DurationKey>("any");
  const [part, setPart] = useState<BodyPart | "any">("any");
  const [kind, setKind] = useState<KindKey>("any");
  const [when, setWhen] = useState<WhenKey>("any");
  const [loc, setLoc] = useState<ExerciseLocation | "any">("any");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pick mode — when Today's empty slot deep-links here, we filter to the
  // matching category and treat a card-tap as "start workout for that slot".
  const rawPick = searchParams.get("pick");
  const pick: SlotPick | null =
    rawPick === "morning-stretch" || rawPick === "morning-pt" || rawPick === "strength"
      ? rawPick
      : null;
  // When Today's "Change" link includes `?replace=<workoutId>`, we delete that
  // workout before creating a new one — so the slot ends up with exactly one
  // doc instead of accumulating abandoned picks.
  const replaceId = searchParams.get("replace");
  // Week planner deep-link: `?date=YYYY-MM-DD` schedules the tapped template
  // for that day instead of today. Unlike slot-pick mode the category tabs stay
  // unlocked, since any workout can go on any day.
  const planDate = searchParams.get("date");
  const picking = !!pick || !!planDate;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const [t, ex] = await Promise.all([
          listTemplates(user.uid),
          listExercises(user.uid),
        ]);
        if (!alive) return;
        setTemplates(t);
        setExercises(ex);
      } catch (e: unknown) {
        console.error("[Library] load failed:", e);
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const gifByExerciseId = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const ex of exercises) m.set(ex.id, ex.gifUrl);
    return m;
  }, [exercises]);

  // Non-archived split by category — the rails live off these.
  const active = useMemo(
    () => (templates ?? []).filter((t) => !t.archived),
    [templates]
  );
  const ptTemplates = useMemo(
    () => active.filter((t) => t.category === "PT Only"),
    [active]
  );
  const strengthTemplates = useMemo(
    () => active.filter((t) => t.category === "Full"),
    [active]
  );
  const archivedTemplates = useMemo(
    () => (templates ?? []).filter((t) => t.archived),
    [templates]
  );

  // Slot-pick locks the tab to that slot's category; browse and date-pick let
  // the user switch freely.
  const effectiveTab: TabKey = pick
    ? pick === "strength"
      ? "strength"
      : "pt"
    : tab;
  const categoryTemplates =
    effectiveTab === "pt" ? ptTemplates : strengthTemplates;
  const buckets = effectiveTab === "pt" ? PT_BUCKETS : STRENGTH_BUCKETS;

  // Search + duration narrowing, applied before the focus-area grouping.
  const visibleTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categoryTemplates.filter((t) => {
      if (q && !`${t.name} ${t.focus}`.toLowerCase().includes(q)) return false;
      if (duration !== "any") {
        const mins = estimatePlannedMinutes(t);
        const band = DURATIONS.find((d) => d.key === duration);
        if (band && (mins < band.min || mins >= band.max)) return false;
      }
      if (part !== "any" && templateLoad(t)[part] === 0) return false;
      if (kind !== "any" && formatOf(t) !== kind) return false;
      if (when !== "any" && whenOf(t) !== when) return false;
      if (loc !== "any" && locationOf(t) !== loc) return false;
      return true;
    });
  }, [categoryTemplates, query, duration, part, kind, when, loc]);

  const locCounts = useMemo(() => {
    let gym = 0, home = 0;
    for (const t of categoryTemplates) {
      if (locationOf(t) === "gym") gym += 1;
      else home += 1;
    }
    return { gym, home };
  }, [categoryTemplates]);

  const whenCounts = useMemo(() => {
    const counts: Record<WhenKey, number> = {
      any: categoryTemplates.length, morning: 0, evening: 0,
    };
    for (const t of categoryTemplates) {
      const w = whenOf(t);
      if (w !== "any") counts[w] += 1;
    }
    return counts;
  }, [categoryTemplates]);

  const kindCounts = useMemo(() => {
    const counts: Record<KindKey, number> = {
      any: categoryTemplates.length, benchmark: 0, guided: 0, standard: 0,
    };
    for (const t of categoryTemplates) counts[formatOf(t)] += 1;
    return counts;
  }, [categoryTemplates]);

  const activeFilters =
    (duration !== "any" ? 1 : 0) +
    (part !== "any" ? 1 : 0) +
    (kind !== "any" ? 1 : 0) +
    (when !== "any" ? 1 : 0) +
    (loc !== "any" ? 1 : 0);

  // How many workouts in this tab train each body part — shown on the rail so
  // an empty filter is obvious before you tap it.
  const partCounts = useMemo(() => {
    const counts = Object.fromEntries(BODY_PARTS.map((b) => [b.key, 0])) as Record<BodyPart, number>;
    for (const t of categoryTemplates) {
      const load = templateLoad(t);
      for (const b of BODY_PARTS) if (load[b.key] > 0) counts[b.key] += 1;
    }
    return counts;
  }, [categoryTemplates]);

  // Counts per duration band for the current category — shown on the chips so
  // empty filters are obvious before you tap them.
  const durationCounts = useMemo(() => {
    const counts: Record<DurationKey, number> = { any: categoryTemplates.length, short: 0, medium: 0, long: 0 };
    for (const t of categoryTemplates) {
      const mins = estimatePlannedMinutes(t);
      for (const d of DURATIONS) {
        if (d.key !== "any" && mins >= d.min && mins < d.max) counts[d.key]++;
      }
    }
    return counts;
  }, [categoryTemplates]);

  const filtering = query.trim().length > 0 || activeFilters > 0;

  const grouped = useMemo(
    () => bucketTemplates(visibleTemplates, buckets),
    [visibleTemplates, buckets]
  );

  // Starter templates the user doesn't have yet (e.g. the gym pack shipped
  // after they first seeded) — drives the "new workouts available" banner.
  const missingStarterCount = useMemo(
    () => countMissingStarterTemplates((templates ?? []).map((t) => t.name)),
    [templates]
  );

  // Templates from earlier versions that newer ones replaced.
  const retired = useMemo(() => findRetiredTemplates(templates ?? []), [templates]);

  async function removeRetired() {
    if (!user || !retired.length) return;
    if (
      !confirm(
        `Delete ${retired.length} old workout${retired.length === 1 ? "" : "s"} that newer versions replaced?\n\nThis won't touch your history — completed workouts stay.`
      )
    ) {
      return;
    }
    const ids = new Set(retired.map((t) => t.id));
    setTemplates((prev) => (prev ?? []).filter((t) => !ids.has(t.id)));
    for (const t of retired) await deleteTemplate(user.uid, t.id);
  }

  async function toggleArchive(t: WorkoutTemplate) {
    if (!user || !templates) return;
    const archived = !t.archived;
    setTemplates(
      templates.map((x) => (x.id === t.id ? { ...x, archived } : x))
    );
    await saveTemplate(user.uid, t.id, { archived });
  }

  async function handleDelete(t: WorkoutTemplate) {
    if (!user || !templates) return;
    if (!confirm(`Delete "${t.name}" permanently?`)) return;
    setTemplates(templates.filter((x) => x.id !== t.id));
    await deleteTemplate(user.uid, t.id);
  }

  /** Save a name / duration edit from TemplateDetailsSheet. A `null` in the
   *  patch means "remove this field" — see TemplatePatch in lib/db. */
  async function handleDetailsSave(t: WorkoutTemplate, patch: TemplatePatch) {
    if (!user || !templates) return;
    setTemplates(
      templates.map((x) => {
        if (x.id !== t.id) return x;
        const next = { ...x, ...patch } as Record<string, unknown>;
        for (const [k, v] of Object.entries(patch)) if (v === null) delete next[k];
        return next as unknown as WorkoutTemplate;
      })
    );
    await saveTemplate(user.uid, t.id, patch);
  }

  async function handleCategoryToggle(t: WorkoutTemplate) {
    if (!user || !templates) return;
    const next: TemplateCategory = t.category === "PT Only" ? "Full" : "PT Only";
    setTemplates(templates.map((x) => (x.id === t.id ? { ...x, category: next } : x)));
    await saveTemplate(user.uid, t.id, { category: next });
  }

  async function handleDuplicate(t: WorkoutTemplate) {
    if (!user || !templates) return;
    const copy: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt"> = {
      name: `${t.name} (copy)`,
      focus: t.focus,
      category: t.category,
      plannedSets: t.plannedSets.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        completedAt: null,
        actualReps: undefined,
        actualWeight: undefined,
        userNotes: undefined,
      })),
      poolWeek: undefined,
      notes: t.notes,
      // Everything that defines HOW the routine runs has to come along. Without
      // `format`/`capMinutes` a duplicated AMRAP loses its clock and its score
      // screen and runs as a plain set list; without `estimatedMinutes` the copy
      // falls back to the per-set model and reads a different length than the
      // routine it was copied from.
      format: t.format,
      capMinutes: t.capMinutes,
      estimatedMinutes: t.estimatedMinutes,
    };
    const id = await createTemplate(user.uid, copy);
    setTemplates([{ id, ...copy }, ...templates]);
  }

  async function handleNew() {
    if (!user) return;
    const name = prompt("Name this template", "New workout");
    if (!name) return;
    const category: TemplateCategory =
      (prompt("Category — 'PT Only' or 'Full'?", "Full") as TemplateCategory) ===
      "PT Only"
        ? "PT Only"
        : "Full";
    const blank: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt"> = {
      name,
      focus: category === "PT Only" ? "Shoulder Rehab" : "Strength + PT",
      category,
      plannedSets: [],
    };
    const id = await createTemplate(user.uid, blank);
    const created: WorkoutTemplate = { id, ...blank };
    setTemplates((prev) => (prev ? [created, ...prev] : [created]));
    setEditing(created);
  }

  async function seedStarterPack() {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      // Make sure every exercise the starter templates reference exists in the
      // user's library first — idempotent, only creates what's missing.
      let ex = exercises;
      const imported = await importMissingNotionExercises(user.uid);
      if (imported > 0 || ex.length === 0) {
        ex = await listExercises(user.uid);
        setExercises(ex);
      }
      const resolved = resolveStarterTemplates(
        ex.map((e) => ({ id: e.id, name: e.name }))
      );
      const existingNames = new Set(
        (templates ?? []).map((t) => t.name.toLowerCase())
      );
      const toCreate = resolved.filter(
        (t) =>
          t.plannedSets.length > 0 && !existingNames.has(t.name.toLowerCase())
      );
      if (!toCreate.length) {
        alert("All starter templates already exist. Nothing new to add.");
        return;
      }
      const created: WorkoutTemplate[] = [];
      for (const t of toCreate) {
        const doc: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt"> = {
          name: t.name,
          focus: t.focus,
          category: t.category,
          plannedSets: t.plannedSets,
          notes: t.notes,
          format: t.format,
          capMinutes: t.capMinutes,
          estimatedMinutes: t.estimatedMinutes,
        };
        const id = await createTemplate(user.uid, doc);
        created.push({ id, ...doc });
      }
      setTemplates((prev) => [...created, ...(prev ?? [])]);
    } catch (e: unknown) {
      console.error("[Library] seed failed:", e);
      alert(`Seed failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  }

  /** Pick mode: start a live workout for the requested slot and jump back
   *  to Today, where the new pick shows up in the big FocusPill. If a
   *  replaceId is present, drop the prior pick first. */
  async function startPickedTemplate(t: WorkoutTemplate) {
    if (!user || !picking || startingId) return;
    setStartingId(t.id);
    try {
      if (replaceId) {
        // Picking something else for a slot that already had a plan is a
        // rejection of what was there. Fetch it before deleting — this page
        // holds templates, not workouts.
        const replaced = await getWorkout(user.uid, replaceId);
        if (replaced && replaced.status === "planned") {
          await recordTrainingSignal(user.uid, signalFor(replaced, "replaced"));
        }
        await deleteWorkout(user.uid, replaceId);
      }
      // Scheduling for a specific day (from the planner) lets the template's
      // own category decide the slot; slot-pick mode forces it.
      await startWorkoutFromTemplate(user.uid, t, {
        slot: pick ?? undefined,
        date: planDate ?? undefined,
      });
      nav(planDate ? "/plan" : "/");
    } catch (e) {
      console.error("[Library] startPickedTemplate failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setStartingId(null);
    }
  }

  async function handleTemplateSetsChanged(nextSets: PlannedSet[]) {
    if (!user || !editing || !templates) return;
    const patched = { ...editing, plannedSets: nextSets };
    setEditing(patched);
    setTemplates(templates.map((t) => (t.id === editing.id ? patched : t)));
    await saveTemplate(user.uid, editing.id, { plannedSets: nextSets });
  }

  if (templates === undefined) {
    return <PageSkeleton rows={5} />;
  }

  const anyStarting = startingId !== null;
  const onRailTap = picking
    ? (t: WorkoutTemplate) => void startPickedTemplate(t)
    : (t: WorkoutTemplate) => setEditing(t);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      {picking ? (
        <PageHeader
          title={
            planDate
              ? "Schedule a workout"
              : pick === "morning-stretch"
              ? "Pick your morning stretch"
              : pick === "morning-pt"
              ? "Pick your shoulder PT"
              : "Pick your workout"
          }
          subtitle={
            planDate
              ? `Tap a workout to add it to ${weekdayLabel(planDate)}.`
              : "Tap a workout to start it for today."
          }
          action={
            <Link
              to={planDate ? "/plan" : "/"}
              className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
            >
              Cancel
            </Link>
          }
        />
      ) : (
        <PageHeader
          title="Routines"
          subtitle={`${templates.length} saved workout${templates.length === 1 ? "" : "s"}`}
          action={
            <button
              onClick={handleNew}
              className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
            >
              New
            </button>
          }
        />
      )}

      {error && (
        <Card>
          <div className="text-[15px] font-semibold text-[color:var(--color-danger)]">
            Couldn't load routines
          </div>
          <div className="mt-1 break-words text-[13px] text-[color:var(--color-muted)]">
            {error}
          </div>
        </Card>
      )}

      {/* NEW STARTER WORKOUTS — browse mode, only when the pack has grown */}
      {!picking && templates.length > 0 && missingStarterCount > 0 && (
        <Card>
          <div className="text-[16px] tracking-[-0.01em]">
            {missingStarterCount} new starter workout
            {missingStarterCount === 1 ? "" : "s"} available
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
            Routines and benchmarks added since you last topped up your
            library. Adding them won't touch anything you already have.
          </p>
          <Button
            variant="secondary"
            onClick={seedStarterPack}
            disabled={seeding}
            block
            className="mt-3"
          >
            {seeding ? "Adding…" : "Add them"}
          </Button>
        </Card>
      )}

      {/* OLD TEMPLATES — offer to clear out superseded versions */}
      {!picking && retired.length > 0 && (
        <Card>
          <div className="text-[16px] tracking-[-0.01em]">
            {retired.length} outdated workout{retired.length === 1 ? "" : "s"}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
            Replaced by newer versions. Your history is unaffected.
          </p>
          <Button variant="secondary" onClick={removeRetired} block className="mt-3">
            Clean up
          </Button>
        </Card>
      )}

      {/* TABS — hidden only when a slot pick locks the category */}
      {!pick && (
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          ptCount={ptTemplates.length}
          strengthCount={strengthTemplates.length}
        />
      )}

      {/* SEARCH + FILTERS — one row. The individual filter rails used to live
          here and pushed the first workout most of a screen down. */}
      {templates.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-2)]"
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workouts"
              aria-label="Search workouts"
              className="h-10 w-full rounded-xl bg-[color:var(--color-surface-2)] pl-9 pr-9 text-[16px] outline-none transition-colors placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--color-muted-2)] text-black"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className={`h-10 shrink-0 rounded-xl px-3.5 text-[15px] font-medium transition-colors ${
              activeFilters > 0
                ? "bg-[color:var(--color-accent)] text-white"
                : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
            }`}
          >
            Filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
          </button>
        </div>
      )}

      {/* BODY */}
      {templates.length === 0 ? (
        <Card>
          <p className="text-[15px] leading-snug">
            No routines yet. Start with the starter pack — PT days, home
            strength days, and gym workouts (leg day, push, pull, full body).
          </p>
          <Button onClick={seedStarterPack} disabled={seeding} block className="mt-4">
            {seeding ? "Adding…" : "Add starter pack"}
          </Button>
          <Button variant="plain" onClick={handleNew} block className="mt-1 !text-[color:var(--color-accent)]">
            Or build one from scratch
          </Button>
        </Card>
      ) : categoryTemplates.length === 0 ? (
        <EmptyState
          title={`No ${effectiveTab === "pt" ? "PT" : "strength"} routines yet`}
          action={
            !picking ? (
              <Button variant="secondary" onClick={handleNew}>
                Create one
              </Button>
            ) : undefined
          }
        />
      ) : visibleTemplates.length === 0 ? (
        <EmptyState
          title="No workouts match those filters"
          description={`${
            query.trim() ? `Nothing named "${query.trim()}"` : "Try a different length"
          } in ${effectiveTab === "pt" ? "PT & mobility" : "strength"}.`}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setDuration("any");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* When filtering, the focus-area grouping just adds noise — show one
              flat, ranked list instead. */}
          {filtering ? (
            <section>
              <SectionHeader
                title={`${visibleTemplates.length} result${
                  visibleTemplates.length === 1 ? "" : "s"
                }`}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setDuration("any");
                    }}
                    className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
                  >
                    Clear
                  </button>
                }
              />
              <div className="space-y-2">
                {visibleTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    gifByExerciseId={gifByExerciseId}
                    isStarting={startingId === t.id}
                    anyStarting={anyStarting}
                    onTap={() => onRailTap(t)}
                  />
                ))}
              </div>
            </section>
          ) : (
            grouped.map(({ bucket, items }) => (
              <section key={bucket?.id ?? "other"}>
                <SectionHeader
                  title={bucket?.title ?? "Other"}
                  action={
                    <span className="text-[13px] tnum text-[color:var(--color-muted)]">
                      {items.length}
                    </span>
                  }
                />
                <div className="space-y-2">
                  {items.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      gifByExerciseId={gifByExerciseId}
                      isStarting={startingId === t.id}
                      anyStarting={anyStarting}
                      onTap={() => onRailTap(t)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {!pick && (
        <Group>
          <Row
            to={planDate ? `/generate?date=${planDate}` : "/generate"}
            title="Build your own"
            subtitle="Pick body parts and length — we'll assemble it"
            chevron
          />
        </Group>
      )}

      {/* MANAGE — browse mode only, collapsed by default */}
      {!picking && templates.length > 0 && (
        <section className="pt-2">
          <Group>
            <Row
              title="Manage all routines"
              value={String(templates.length)}
              onClick={() => setShowManage((v) => !v)}
              trailing={
                <svg
                  className={`shrink-0 text-[color:var(--color-muted-2)] transition-transform ${
                    showManage ? "rotate-180" : ""
                  }`}
                  width="12" height="8" viewBox="0 0 12 8" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="1 1.5 6 6.5 11 1.5" />
                </svg>
              }
            />
          </Group>

          {showManage && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3 text-[15px] text-[color:var(--color-accent)]">
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="active:opacity-60"
                >
                  {showArchived ? "Hide archived" : "Show archived"}
                </button>
                <button
                  type="button"
                  onClick={seedStarterPack}
                  disabled={seeding}
                  className="active:opacity-60 disabled:opacity-30"
                >
                  {seeding ? "Adding…" : "Add starter pack"}
                </button>
              </div>

              <Group>
                {[...active, ...(showArchived ? archivedTemplates : [])].map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    isStarting={startingId === t.id}
                    anyStarting={anyStarting}
                    onEdit={() => setEditing(t)}
                    onToggleArchive={() => void toggleArchive(t)}
                    onDelete={() => void handleDelete(t)}
                    onEditDetails={() => setEditingDetails(t)}
                    onToggleCategory={() => void handleCategoryToggle(t)}
                    onDuplicate={() => void handleDuplicate(t)}
                  />
                ))}
              </Group>
            </div>
          )}
        </section>
      )}

      {filtersOpen && (
        <Sheet onClose={() => setFiltersOpen(false)} label="Filter workouts">
          <SheetHeader
            title="Filters"
            onCancel={() => setFiltersOpen(false)}
            action={
              activeFilters > 0 ? (
                <button
                  onClick={() => {
                    setDuration("any");
                    setPart("any");
                    setKind("any");
                    setWhen("any");
                    setLoc("any");
                  }}
                  className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
                >
                  Reset
                </button>
              ) : undefined
            }
          />
          <div className="space-y-5 overflow-y-auto px-4 pb-8 pt-2">
            <section>
              <SectionHeader title="Type" />
              <Group>
                {KINDS.map((k) => (
                  <Row
                    key={k.key}
                    title={k.label}
                    subtitle={k.sub || undefined}
                    value={k.key === "any" ? undefined : String(kindCounts[k.key])}
                    onClick={() => setKind(k.key)}
                    trailing={kind === k.key ? <Tick /> : undefined}
                  />
                ))}
              </Group>
            </section>

            <section>
              <SectionHeader title="Where" />
              <Group>
                <Row
                  title="Anywhere"
                  onClick={() => setLoc("any")}
                  trailing={loc === "any" ? <Tick /> : undefined}
                />
                <Row
                  title="Home"
                  subtitle="Nothing that needs a gym"
                  value={String(locCounts.home)}
                  onClick={() => setLoc("home")}
                  trailing={loc === "home" ? <Tick /> : undefined}
                />
                <Row
                  title="Gym"
                  subtitle="Needs machines, cables or a barbell"
                  value={String(locCounts.gym)}
                  onClick={() => setLoc("gym")}
                  trailing={loc === "gym" ? <Tick /> : undefined}
                />
              </Group>
            </section>

            <section>
              <SectionHeader title="Time of day" />
              <Group>
                {WHENS.map((w) => (
                  <Row
                    key={w.key}
                    title={w.label}
                    subtitle={w.sub || undefined}
                    value={w.key === "any" ? undefined : String(whenCounts[w.key])}
                    onClick={() => setWhen(w.key)}
                    trailing={when === w.key ? <Tick /> : undefined}
                  />
                ))}
              </Group>
            </section>

            <section>
              <SectionHeader title="Length" />
              <Group>
                {DURATIONS.map((d) => (
                  <Row
                    key={d.key}
                    title={d.label}
                    subtitle={d.sub || undefined}
                    value={String(durationCounts[d.key])}
                    onClick={() => setDuration(d.key)}
                    trailing={duration === d.key ? <Tick /> : undefined}
                  />
                ))}
              </Group>
            </section>

            <section>
              <SectionHeader title="Body part" />
              <Group>
                <Row
                  title="Any body part"
                  onClick={() => setPart("any")}
                  trailing={part === "any" ? <Tick /> : undefined}
                />
                {BODY_PARTS.map((b) => (
                  <Row
                    key={b.key}
                    title={b.label}
                    value={String(partCounts[b.key])}
                    onClick={() => setPart(b.key)}
                    trailing={part === b.key ? <Tick /> : undefined}
                  />
                ))}
              </Group>
            </section>

            <Button size="lg" block onClick={() => setFiltersOpen(false)}>
              Show {visibleTemplates.length} workout
              {visibleTemplates.length === 1 ? "" : "s"}
            </Button>
          </div>
        </Sheet>
      )}

      {editing && (
        <ManagePlanSheet
          workout={templateAsWorkout(editing)}
          exercises={exercises}
          gifByExerciseId={gifByExerciseId}
          onChange={handleTemplateSetsChanged}
          onClose={() => setEditing(null)}
        />
      )}

      {editingDetails && (
        <TemplateDetailsSheet
          template={editingDetails}
          onSave={(patch) => handleDetailsSave(editingDetails, patch)}
          onClose={() => setEditingDetails(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// FOCUS BUCKETS
// ------------------------------------------------------------------

type FocusBucket = {
  id: string;
  title: string;
  match: (focus: string) => boolean;
};

/** PT / Mobility buckets. First-match-wins — order deliberate so shoulder
 *  rehab templates don't get captured by the broader mobility bucket. */
const PT_BUCKETS: FocusBucket[] = [
  {
    id: "shoulder",
    title: "Shoulder & Rotator Cuff",
    match: (f) => /shoulder|rotator|scap/.test(f),
  },
  {
    id: "mobility",
    title: "Mobility & Stretch",
    match: (f) => /mobility|stretch|yoga|tissue|t.spine|opening|wake/.test(f),
  },
  {
    id: "recovery",
    title: "Recovery & Gentle",
    match: (f) => /recovery|gentle|breathing|desk|decompress|low.load|easy/.test(f),
  },
  {
    id: "activation",
    title: "Activation & Warm-up",
    match: (f) => /activation|warm|minimum/.test(f),
  },
];

/** Strength buckets — also first-match-wins. Upper/Lower/Core before
 *  Full-Body so "Lower Body + Shoulder Rehab" goes to Lower, not Other. */
const STRENGTH_BUCKETS: FocusBucket[] = [
  {
    id: "upper",
    title: "Upper Body",
    match: (f) => /upper|push|pull|chest|triceps|back|biceps|arm/.test(f),
  },
  {
    id: "lower",
    title: "Lower Body",
    match: (f) => /lower|leg|glute|hip|squat|hinge|posterior/.test(f),
  },
  {
    id: "core",
    title: "Core",
    match: (f) => /core|abs|trunk|anti.rotation|anti.extension/.test(f),
  },
  {
    id: "cardio",
    title: "Cardio + Conditioning",
    match: (f) => /cardio|zone|conditioning|run|hiit/.test(f),
  },
  {
    id: "full",
    title: "Full-Body",
    match: (f) => /full|total|whole|top.to.bottom|express|kb /.test(f),
  },
];

function bucketTemplates(
  templates: WorkoutTemplate[],
  buckets: FocusBucket[]
): { bucket: FocusBucket | null; items: WorkoutTemplate[] }[] {
  const assigned = new Map<string, WorkoutTemplate[]>();
  for (const b of buckets) assigned.set(b.id, []);
  const other: WorkoutTemplate[] = [];
  for (const t of templates) {
    const f = (t.focus ?? "").toLowerCase();
    const hit = buckets.find((b) => b.match(f));
    if (hit) assigned.get(hit.id)!.push(t);
    else other.push(t);
  }
  // Alpha-sort inside each bucket for stable scan order.
  const out: { bucket: FocusBucket | null; items: WorkoutTemplate[] }[] = [];
  for (const b of buckets) {
    const items = assigned.get(b.id)!;
    if (items.length === 0) continue;
    items.sort((a, b) => a.name.localeCompare(b.name));
    out.push({ bucket: b, items });
  }
  if (other.length) {
    other.sort((a, b) => a.name.localeCompare(b.name));
    out.push({ bucket: null, items: other });
  }
  return out;
}

// ------------------------------------------------------------------
// SEGMENTED TABS
// ------------------------------------------------------------------

function Tick() {
  return (
    <svg
      className="shrink-0 text-[color:var(--color-accent)]"
      width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SegmentedTabs({
  value,
  onChange,
  ptCount,
  strengthCount,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  ptCount: number;
  strengthCount: number;
}) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: "pt" as TabKey, label: `PT & mobility (${ptCount})` },
        { value: "strength" as TabKey, label: `Strength (${strengthCount})` },
      ]}
    />
  );
}

// ------------------------------------------------------------------
// FOCUS RAIL — horizontal scrolling row of FocusCards
// ------------------------------------------------------------------

/** "2026-08-12" → "Wednesday" — used in the planner deep-link header. */
function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
}

/** Unique exercises in a template, in first-appearance order. */
function uniqueExercises(t: WorkoutTemplate): { id: string; name: string }[] {
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const s of t.plannedSets) {
    if (seen.has(s.exerciseId)) continue;
    seen.add(s.exerciseId);
    out.push({ id: s.exerciseId, name: s.exerciseName });
  }
  return out;
}

/** Small circular exercise demo for the template-card collage. */
function MiniThumb({ name, gifUrl }: { name: string; gifUrl?: string }) {
  const src = gifUrl || findGifForName(name);
  return (
    <div className="-ml-2.5 grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-black ring-2 ring-[color:var(--color-surface)] first:ml-0">
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold text-white/30">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/**
 * Full-width workout card. Replaced the old 200px horizontal rail cards —
 * at that size the name wrapped, the stats were cramped, and scanning meant
 * swiping sideways through every focus area.
 */
function TemplateCard({
  template,
  gifByExerciseId,
  isStarting,
  anyStarting,
  onTap,
}: {
  template: WorkoutTemplate;
  gifByExerciseId: Map<string, string | undefined>;
  isStarting: boolean;
  anyStarting: boolean;
  onTap: () => void;
}) {
  const exs = uniqueExercises(template);
  const shown = exs.slice(0, 4);
  const extra = exs.length - shown.length;
  const mins = estimatePlannedMinutes(template);

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={anyStarting}
      className={`w-full rounded-[12px] p-3 text-left transition-colors ${
        isStarting
          ? "bg-[color:var(--color-surface-2)]"
          : "bg-[color:var(--color-surface)] active:bg-[color:var(--color-surface-2)]"
      } ${anyStarting && !isStarting ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-tight tracking-[-0.01em]">
            {template.name}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-[color:var(--color-muted)]">
            {template.focus}
          </div>
        </div>
        <div className="shrink-0 text-[15px] tnum text-[color:var(--color-muted)]">
          {Math.round(mins)} min
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        {/* Overlapping exercise-demo collage — shows at a glance what's in it */}
        <div className="flex items-center">
          {shown.map((ex) => (
            <MiniThumb key={ex.id} name={ex.name} gifUrl={gifByExerciseId.get(ex.id)} />
          ))}
          {extra > 0 && (
            <div className="-ml-2 grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--color-surface-2)] text-[11px] tnum text-[color:var(--color-muted)] ring-2 ring-[color:var(--color-surface)]">
              +{extra}
            </div>
          )}
        </div>
        <div className="shrink-0 text-[13px] tnum text-[color:var(--color-muted)]">
          {isStarting
            ? "Starting…"
            : template.format === "amrap"
            ? // An AMRAP's set list is one round, so "16 sets" would be a lie.
              `${exs.length} exercises · 1 round`
            : `${exs.length} exercises · ${template.plannedSets.length} sets`}
        </div>
      </div>
    </button>
  );
}

// ------------------------------------------------------------------
// MANAGE SECTION — flat rows with three-dot menu
// ------------------------------------------------------------------

function TemplateRow({
  template,
  isStarting,
  anyStarting,
  onEdit,
  onToggleArchive,
  onDelete,
  onEditDetails,
  onToggleCategory,
  onDuplicate,
}: {
  template: WorkoutTemplate;
  isStarting: boolean;
  anyStarting: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onEditDetails: () => void;
  onToggleCategory: () => void;
  onDuplicate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPT = template.category === "PT Only";

  return (
    <div
      className={`relative ${template.archived ? "opacity-60" : ""} ${
        anyStarting && !isStarting ? "opacity-50" : ""
      }`}
    >
      <Row
        onClick={anyStarting ? undefined : onEdit}
        title={template.name}
        subtitle={`${isPT ? "PT" : "Strength"}${
          template.archived ? " · Archived" : ""
        } · ${template.plannedSets.length} sets`}
        trailing={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label={`Actions for ${template.name}`}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--color-muted-2)] active:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        }
      />
      {menuOpen && (
        <>
          <button
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-2 top-11 z-20 w-52 overflow-hidden rounded-[12px] bg-[color:var(--color-surface-2)] shadow-xl">
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                onEditDetails();
              }}
            >
              Name &amp; duration…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                onToggleCategory();
              }}
            >
              Switch to {isPT ? "Full" : "PT Only"}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                onDuplicate();
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                onToggleArchive();
              }}
            >
              {template.archived ? "Unarchive" : "Archive"}
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              Delete
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-b border-[color:var(--color-separator)] px-4 py-2.5 text-left text-[15px] last:border-0 active:bg-[color:var(--color-surface-3)] ${
        danger ? "text-[color:var(--color-danger)]" : ""
      }`}
    >
      {children}
    </button>
  );
}

/** Wrap a template in a synthetic Workout so ManagePlanSheet (typed against
 *  Workout) can edit it. Only plannedSets and title are read by the sheet. */
function templateAsWorkout(t: WorkoutTemplate): Workout {
  return {
    id: t.id,
    date: "",
    title: t.name,
    focus: t.focus,
    status: "planned",
    plannedSets: t.plannedSets,
  };
}
