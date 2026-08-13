import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Group,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  Row,
  SectionHeader,
  Stat,
} from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import SupplementCard from "../components/SupplementCard";
import { listTemplates, listWorkoutsInRange } from "../lib/db";
import { prettyDate, todayStr, weekRange } from "../lib/dates";
import { setMinutes } from "../lib/timeEstimate";
import {
  WEEKLY_GOALS,
  type TemplateCategory,
  type Workout,
} from "../lib/types";

type SlotName = "morning-pt" | "strength";

/**
 * Home. Top → bottom:
 *   1. Up-next card — the one workout you're most likely to open right now,
 *      with the primary CTA. Hidden when both slots are empty or finished.
 *   2. Today's sessions — the two slots as a plain two-row list.
 *   3. This week — day strip + goal bars.
 *   4. Progress + recent history, once the day has actually started.
 *
 * The old version made every one of these a differently-colored card, which
 * meant nothing looked more important than anything else. Now exactly one
 * element carries the accent: the CTA.
 */
export default function Today() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // focusedSlot drives the up-next card. Synced from the most-recently-created
  // active workout whenever the set of active IDs changes, but in-session taps
  // on a session row override it.
  const [focusedSlot, setFocusedSlot] = useState<SlotName | null>(null);

  const { start: weekStart, end: weekEnd } = weekRange();
  const today = todayStr();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        // Pull the last 30 days in one range query and slice locally (today +
        // this week + recent history all derive from this).
        const start = daysAgoStr(30);
        const [, recent] = await Promise.all([
          // Warm the templates cache so the pick screen loads instantly.
          listTemplates(user.uid),
          listWorkoutsInRange(user.uid, start, today),
        ]);
        if (!alive) return;
        setRecentWorkouts(recent);
        setError(null);
      } catch (e: unknown) {
        console.error("[Today] load failed:", e);
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
          setRecentWorkouts([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, today]);

  const todayWorkouts = useMemo(
    () => (recentWorkouts ?? []).filter((w) => w.date === today),
    [recentWorkouts, today]
  );
  const weekWorkouts = useMemo(
    () => (recentWorkouts ?? []).filter((w) => w.date >= weekStart && w.date <= weekEnd),
    [recentWorkouts, weekStart, weekEnd]
  );

  // Per-slot lookup. A slot can have at most one in-progress/planned doc;
  // a separate completed doc for the same slot means that slot is done.
  function slotDocs(slotName: SlotName, cat: TemplateCategory) {
    const docs = todayWorkouts.filter((w) => {
      if (w.slot) return w.slot === slotName;
      if (w.category) return w.category === cat;
      return false;
    });
    return {
      active: docs.find((w) => w.status === "in_progress" || w.status === "planned"),
      completed: docs.find((w) => w.status === "completed"),
    };
  }
  const ptSlot = slotDocs("morning-pt", "PT Only");
  const fullSlot = slotDocs("strength", "Full");

  const activePtId = ptSlot.active?.id;
  const activeFullId = fullSlot.active?.id;
  useEffect(() => {
    const pt = ptSlot.active;
    const full = fullSlot.active;
    if (!pt && !full) return setFocusedSlot(null);
    if (pt && !full) return setFocusedSlot("morning-pt");
    if (!pt && full) return setFocusedSlot("strength");
    setFocusedSlot((pt?.createdAt ?? 0) >= (full?.createdAt ?? 0) ? "morning-pt" : "strength");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePtId, activeFullId]);

  const focusedWorkout = useMemo<Workout | null>(() => {
    if (focusedSlot === "morning-pt") return ptSlot.active ?? null;
    if (focusedSlot === "strength") return fullSlot.active ?? null;
    return null;
  }, [focusedSlot, ptSlot.active, fullSlot.active]);

  async function resumeActive(w: Workout) {
    if (!user) return;
    // A workout that hasn't started yet gets the targets review first; it
    // redirects straight into the runner when there's nothing to confirm.
    // Resuming skips it — you're mid-session, the numbers are already set.
    if (w.status === "planned") {
      nav(`/workout/${w.id}/review`);
      return;
    }
    nav(`/workout/${w.id}`);
  }

  const completedCounts = useMemo(() => {
    const counts: Record<TemplateCategory, number> = { "PT Only": 0, Full: 0 };
    for (const w of weekWorkouts) {
      if (w.status !== "completed") continue;
      const cat = (w.category ?? inferCategoryFromWorkout(w)) as TemplateCategory;
      counts[cat] += 1;
    }
    return counts;
  }, [weekWorkouts]);

  // Today-only totals, split by track: PT/Stretch sets on one, strength on
  // the other. Drives the progress block near the bottom.
  const todayStats = useMemo(() => {
    let ptSetsDone = 0, ptSetsTotal = 0, ptMinDone = 0, ptMinTotal = 0;
    let strSetsDone = 0, strSetsTotal = 0, strMinDone = 0, strMinTotal = 0;
    let volumeLbs = 0;
    for (const w of todayWorkouts) {
      for (const s of w.plannedSets ?? []) {
        const mins = setMinutes(s);
        const isPT = s.setType === "PT/Rehab" || s.setType === "Stretch";
        if (isPT) {
          ptSetsTotal += 1;
          ptMinTotal += mins;
          if (s.completedAt) {
            ptSetsDone += 1;
            ptMinDone += mins;
          }
        } else {
          strSetsTotal += 1;
          strMinTotal += mins;
          if (s.completedAt) {
            strSetsDone += 1;
            strMinDone += mins;
            const reps = s.actualReps ?? s.targetReps ?? 0;
            const wgt = s.actualWeight ?? s.targetWeight ?? 0;
            if (reps && wgt) volumeLbs += reps * wgt;
          }
        }
      }
    }
    return {
      ptSetsDone, ptSetsTotal, ptMinDone, ptMinTotal,
      strSetsDone, strSetsTotal, strMinDone, strMinTotal, volumeLbs,
    };
  }, [todayWorkouts]);

  const recentHistory = useMemo(() => {
    const sevenAgo = daysAgoStr(7);
    return (recentWorkouts ?? [])
      .filter((w) => w.date < today && w.date >= sevenAgo)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [recentWorkouts, today]);

  const anyStartedToday = todayWorkouts.some(
    (w) => w.status === "in_progress" || w.status === "completed"
  );

  if (recentWorkouts === undefined) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Today" subtitle={longDate(today)} />

      {error && (
        <Card className="bg-[color:var(--color-danger)]/10">
          <div className="text-[15px] font-semibold text-[color:var(--color-danger)]">
            Couldn't load today
          </div>
          <div className="mt-1 break-words text-[13px] text-[color:var(--color-muted)]">
            {error}
          </div>
        </Card>
      )}

      {focusedWorkout && focusedSlot && (
        <UpNext
          slot={focusedSlot}
          workout={focusedWorkout}
          onStart={() => void resumeActive(focusedWorkout)}
          onChange={() => nav(`/library?pick=${focusedSlot}&replace=${focusedWorkout.id}`)}
        />
      )}

      <section>
        <SectionHeader title="Today's sessions" />
        <Group>
          <SessionRow
            title="Morning PT"
            emptyLabel="Choose a PT routine"
            active={ptSlot.active}
            completed={ptSlot.completed}
            pickHref="/library?pick=morning-pt"
            isFocused={focusedSlot === "morning-pt"}
            onFocus={() => setFocusedSlot("morning-pt")}
          />
          <SessionRow
            title="Strength"
            emptyLabel="Choose a workout"
            active={fullSlot.active}
            completed={fullSlot.completed}
            pickHref="/library?pick=strength"
            isFocused={focusedSlot === "strength"}
            onFocus={() => setFocusedSlot("strength")}
          />
          <Row
            to="/recommend"
            title="Not sure what to do?"
            subtitle="Tell me what's sore and I'll pick"
            chevron
          />
        </Group>
      </section>

      <SupplementCard />

      <section>
        <SectionHeader
          title="This week"
          action={
            <span className="text-[13px] text-[color:var(--color-muted)] tnum">
              {shortRange(weekStart, weekEnd)}
            </span>
          }
        />
        <Card>
          <WeekStrip weekStart={weekStart} today={today} workouts={weekWorkouts} />
          <div className="mt-5 space-y-3.5">
            <GoalRow
              label="PT days"
              done={completedCounts["PT Only"] + completedCounts.Full}
              goal={WEEKLY_GOALS["PT Only"] + WEEKLY_GOALS.Full}
            />
            <GoalRow
              label="Strength days"
              done={completedCounts.Full}
              goal={WEEKLY_GOALS.Full}
            />
          </div>
        </Card>
      </section>

      {anyStartedToday && (
        <section>
          <SectionHeader title="Today's progress" />
          <Card>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                value={`${todayStats.ptSetsDone + todayStats.strSetsDone}`}
                label="Sets done"
              />
              <Stat
                value={`${Math.round(todayStats.ptMinDone + todayStats.strMinDone)}m`}
                label="Time"
              />
              <Stat
                value={todayStats.volumeLbs > 0 ? formatLbs(todayStats.volumeLbs) : "—"}
                label="Volume (lb)"
              />
            </div>
            <p className="mt-4 text-[13px] leading-snug text-[color:var(--color-muted)]">
              {encouragement(
                todayStats.ptSetsDone + todayStats.strSetsDone,
                todayStats.ptSetsTotal + todayStats.strSetsTotal
              )}
            </p>
          </Card>
        </section>
      )}

      {recentHistory.length > 0 && (
        <section>
          <SectionHeader
            title="Recent"
            action={
              <Link to="/history" className="text-[15px] text-[color:var(--color-accent)]">
                See all
              </Link>
            }
          />
          <Group>
            {recentHistory.slice(0, 5).map((w) => (
              <Row
                key={w.id}
                to={w.status === "completed" ? `/history/${w.id}` : `/workout/${w.id}`}
                title={w.title}
                subtitle={`${prettyDate(w.date)} · ${setsCompleted(w)} of ${setsTotal(w)} sets`}
                // Finished is the norm here, so only flag the exceptions.
                trailing={
                  w.status !== "completed" ? <StatusDot status={w.status} /> : undefined
                }
                chevron
              />
            ))}
          </Group>
        </section>
      )}

      <Link to="/new" className="block">
        <Button variant="secondary" size="lg" block>
          New workout
        </Button>
      </Link>
    </div>
  );
}

/* -------------------------------- Up next -------------------------------- */

/**
 * The one card that gets visual weight. Flat surface, not a gradient — the
 * emphasis comes from the filled CTA and from being first on the page.
 */
function UpNext({
  slot,
  workout,
  onStart,
  onChange,
}: {
  slot: SlotName;
  workout: Workout;
  onStart: () => void;
  onChange: () => void;
}) {
  const done = setsCompleted(workout);
  const total = setsTotal(workout);
  const inProgress = workout.status === "in_progress";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-[color:var(--color-muted)]">
            {slot === "morning-pt" ? "Morning PT" : "Strength"}
            {inProgress && " · In progress"}
          </div>
          <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] leading-tight">
            {workout.title}
          </h2>
          <div className="mt-0.5 text-[15px] text-[color:var(--color-muted)]">
            {workout.focus}
          </div>
        </div>
        {/* Two explicit actions: look at what's in it, or swap it out. Before
            this, opening a workout to see the exercises meant starting it. */}
        <div className="flex shrink-0 items-center gap-3 pt-0.5 text-[15px] text-[color:var(--color-accent)]">
          <Link to={`/planned/${workout.id}`} className="active:opacity-60">
            View
          </Link>
          <button onClick={onChange} className="active:opacity-60">
            Change
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={done} max={total} className="flex-1" />
        <span className="shrink-0 text-[13px] text-[color:var(--color-muted)] tnum">
          {done} of {total} sets
        </span>
      </div>

      <Button size="lg" block onClick={onStart} className="mt-4">
        {inProgress ? "Resume workout" : "Start workout"}
      </Button>
    </Card>
  );
}

/* ------------------------------ Session rows ----------------------------- */

function SessionRow({
  title,
  emptyLabel,
  active,
  completed,
  pickHref,
  isFocused,
  onFocus,
}: {
  title: string;
  emptyLabel: string;
  active: Workout | undefined;
  completed: Workout | undefined;
  pickHref: string;
  isFocused: boolean;
  onFocus: () => void;
}) {
  // The slot name and the workout title are often the same string ("Morning
  // PT"); showing both would just read as a stutter.
  const sub = (w: Workout) => (w.title === title ? undefined : w.title);

  if (completed && !active) {
    return (
      <Row
        to={`/history/${completed.id}`}
        leading={<CheckBadge />}
        title={title}
        subtitle={sub(completed)}
        value="Done"
        chevron
      />
    );
  }
  if (active) {
    const done = setsCompleted(active);
    const total = setsTotal(active);
    return (
      <Row
        onClick={onFocus}
        leading={<StatusDot status={active.status} />}
        title={title}
        subtitle={sub(active)}
        value={isFocused ? undefined : `${done}/${total}`}
        trailing={
          isFocused ? (
            <span className="text-[13px] text-[color:var(--color-accent)]">Up next</span>
          ) : (
            <Link
              to={`/planned/${active.id}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 px-1 text-[15px] text-[color:var(--color-accent)] active:opacity-60"
            >
              View
            </Link>
          )
        }
      />
    );
  }
  return (
    <Row
      to={pickHref}
      leading={<PlusBadge />}
      title={title}
      subtitle={emptyLabel}
      chevron
    />
  );
}

function CheckBadge() {
  return (
    <div className="grid size-7 place-items-center rounded-full bg-[color:var(--color-success)] text-white">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function PlusBadge() {
  return (
    <div className="grid size-7 place-items-center rounded-full bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </div>
  );
}

function StatusDot({ status }: { status: Workout["status"] }) {
  const tone =
    status === "completed"
      ? "bg-[color:var(--color-success)]"
      : status === "in_progress"
      ? "bg-[color:var(--color-accent)]"
      : "bg-[color:var(--color-muted-2)]";
  return <span className={`block size-2 shrink-0 rounded-full ${tone}`} aria-hidden />;
}

/* ------------------------------- Week strip ------------------------------ */

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Mon→Sun. Filled dot for a completed day, ring for today, dim otherwise. */
function WeekStrip({
  weekStart,
  today,
  workouts,
}: {
  weekStart: string;
  today: string;
  workouts: Workout[];
}) {
  const completedDates = new Set(
    workouts.filter((w) => w.status === "completed").map((w) => w.date)
  );
  return (
    <div className="flex justify-between">
      {DAY_LETTERS.map((letter, i) => {
        const date = addDaysStr(weekStart, i);
        const isDone = completedDates.has(date);
        const isToday = date === today;
        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <span
              className={`text-[12px] ${
                isToday
                  ? "text-[color:var(--color-accent)]"
                  : "text-[color:var(--color-muted)]"
              }`}
            >
              {letter}
            </span>
            <div
              className={`grid size-8 place-items-center rounded-full text-[13px] tnum ${
                isDone
                  ? "bg-[color:var(--color-success)] text-white"
                  : isToday
                  ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-accent)] ring-1 ring-[color:var(--color-accent)]"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted-2)]"
              }`}
            >
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                Number(date.slice(8))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- Goal row ------------------------------- */

function GoalRow({ label, done, goal }: { label: string; done: number; goal: number }) {
  const hit = done >= goal;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[15px]">{label}</span>
        <span className="text-[15px] tnum text-[color:var(--color-muted)]">
          <span className={hit ? "text-[color:var(--color-success)]" : "text-white"}>
            {done}
          </span>
          {" / "}
          {goal}
        </span>
      </div>
      <ProgressBar value={done} max={goal} tone={hit ? "success" : "accent"} />
    </div>
  );
}

/* -------------------------------- Helpers -------------------------------- */

/** One encouraging line, tied to how far through the day's sets you are. */
function encouragement(done: number, total: number): string {
  if (total === 0) return "Nothing scheduled today. Rest counts too.";
  const pct = done / total;
  if (pct === 0) return "Fresh tank. Start with set one.";
  if (pct < 0.5) return "Warmed up and moving. Stack the next set.";
  if (pct < 1) return "Back half of the day — close it out.";
  return "Everything logged. That's a full day on the books.";
}

/** "2026-08-12" → "Wednesday, August 12" */
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "2026-08-10","2026-08-16" → "Aug 10 – 16" */
function shortRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  const mon = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
  return sm === em ? `${mon(sm)} ${sd} – ${ed}` : `${mon(sm)} ${sd} – ${mon(em)} ${ed}`;
}

function addDaysStr(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

function setsCompleted(w: Workout): number {
  return (w.plannedSets ?? []).filter((s) => s.completedAt).length;
}
function setsTotal(w: Workout): number {
  return (w.plannedSets ?? []).length;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

function formatLbs(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Best-effort category for legacy workouts with no `category` field. */
function inferCategoryFromWorkout(w: Workout): TemplateCategory {
  if (w.slot === "morning-pt") return "PT Only";
  if (w.slot === "strength") return "Full";
  const hay = `${w.title || ""} ${w.focus || ""}`.toLowerCase();
  if (/\bpt\b|rehab|recovery/.test(hay) && !/strength|upper|lower|core|full body/.test(hay)) {
    return "PT Only";
  }
  return "Full";
}
