import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  deleteWorkout,
  clearTrainingSignals,
  getTrainingSignals,
  getWeeklyGoals,
  recordTrainingSignal,
  saveWorkout as saveWorkoutDoc,
  listTemplates,
  listWorkoutsInRange,
  saveWeeklyGoals,
  saveWorkout,
  startWorkoutFromTemplate,
} from "../lib/db";
import {
  Card,
  Group,
  PageSkeleton,
  Row,
  SectionHeader,
  Sheet,
  SheetHeader,
} from "../components/ui";
import { autoPlanWeek } from "../lib/autoPlan";
import { isMorningSlot } from "../lib/slots";
import {
  NO_PREFERENCES,
  derivePreferences,
  signalFor,
  type Preferences,
} from "../lib/trainingSignals";
import { applyTargets, suggestTargets } from "../lib/progression";
import { Segmented } from "../components/ui";
import type { WorkoutTemplate } from "../lib/types";
import { todayStr, weekRange } from "../lib/dates";
import { estimatePlannedMinutes, formatMinutes } from "../lib/timeEstimate";
import type { PlannedSet, Workout } from "../lib/types";
import {
  DEFAULT_GOALS,
  KINDS,
  countByKind,
  kindOf,
  plannedByKind,
  type WeeklyGoals,
  type WorkoutKind,
} from "../lib/weeklyGoals";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Week planner — lay out which workout happens on which day.
 *
 * Scheduling a template creates a `planned` Workout doc dated for that day, so
 * it flows straight into Today when the date arrives (Today reads workouts
 * where date === today). Picking happens over in Library via
 * `/library?date=YYYY-MM-DD`, which returns here afterwards.
 *
 * `weekOffset` shifts the Mon–Sun window: 0 = this week, 1 = next, -1 = last.
 */
export default function Plan() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [goals, setGoals] = useState<WeeklyGoals>(DEFAULT_GOALS);
  const [editingGoals, setEditingGoals] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [planning, setPlanning] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [moving, setMoving] = useState<Workout | null>(null);
  const [switching, setSwitching] = useState<Workout | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(NO_PREFERENCES);
  const [showLearned, setShowLearned] = useState(false);
  // Goals are a reference number you set once, not something you read every
  // visit — collapsed by default so the week itself is what you land on.
  const [goalsOpen, setGoalsOpen] = useState(false);

  const today = todayStr();
  const { start, end } = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return weekRange(d);
  }, [weekOffset]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start]
  );

  /**
   * Mon–Sun is the right order for a week you're planning, but the wrong one
   * for the week you're in — you open this on a Thursday to see Thursday, not
   * to scroll past three days that already happened. For the current week the
   * list starts at today and the earlier days move to a section at the bottom.
   */
  const { leadDays, pastDays } = useMemo(() => {
    if (weekOffset !== 0) return { leadDays: days, pastDays: [] as string[] };
    return {
      leadDays: days.filter((d) => d >= today),
      pastDays: days.filter((d) => d < today),
    };
  }, [days, weekOffset, today]);

  const dayName = (date: string) => DAY_NAMES[days.indexOf(date)];

  const load = useCallback(async () => {
    if (!user) return;
    const [ws, g, t, history, signals] = await Promise.all([
      listWorkoutsInRange(user.uid, start, end),
      getWeeklyGoals(user.uid),
      listTemplates(user.uid),
      listWorkoutsInRange(user.uid, addDays(start, -56), addDays(start, -1)),
      getTrainingSignals(user.uid),
    ]);
    setWorkouts(ws);
    setGoals(g);
    setTemplates(t);
    setPrefs(derivePreferences({ workouts: history, signals, templates: t, today }));
  }, [user, start, end, today]);

  /** Forget every opinion about one routine, so it's offered again. */
  async function offerAgain(name: string) {
    if (!user) return;
    await clearTrainingSignals(user.uid, name);
    await load();
  }

  /** Fill every empty day from the weekly goals. Never overwrites. */
  async function planWeek() {
    if (!user || planning) return;
    setPlanning(true);
    setPlanMsg(null);
    try {
      // Two different lookbacks. A fortnight decides what NOT to repeat; two
      // months is what the preferences are read from, because an opinion needs
      // more than one week of evidence behind it.
      const prior = await listWorkoutsInRange(
        user.uid,
        addDays(start, -14),
        addDays(start, -1)
      );
      const [history, signals] = await Promise.all([
        listWorkoutsInRange(user.uid, addDays(start, -56), addDays(start, -1)),
        getTrainingSignals(user.uid),
      ]);
      const preferences = derivePreferences({
        workouts: history,
        signals,
        templates,
        today,
      });
      const { items, shortfalls } = autoPlanWeek({
        days,
        existing: workouts ?? [],
        goals,
        templates,
        recentNames: new Set(prior.map((w) => w.title)),
        // Don't back-fill days that have already passed.
        notBefore: weekOffset === 0 ? today : undefined,
        preferences,
      });
      const missed = shortfalls
        .filter((s) => s.got < s.wanted)
        .map((s) => `${s.kind} (${s.got}/${s.wanted})`);
      if (!items.length) {
        // Nothing scheduled means one of two very different things, and saying
        // the wrong one leaves a user with an empty library staring at seven
        // blank days being told the week is full.
        setPlanMsg(
          missed.length
            ? `Nothing to schedule — your library is missing: ${missed.join(", ")}.`
            : "Every day already has a morning routine and a main session."
        );
        return;
      }
      for (const item of items) {
        const id = await startWorkoutFromTemplate(user.uid, item.template, {
          date: item.date,
          slot: item.slot,
        });
        // Two edits to what just got scheduled, both from your own history:
        // leave out the exercises you keep removing from this routine, and
        // set the weights from what you actually lifted last time rather than
        // whatever the template was written with months ago.
        const patch = tailorToHistory(item.template, id, history, preferences);
        if (patch) await saveWorkoutDoc(user.uid, id, patch);
      }
      await load();
      setPlanMsg(
        `Scheduled ${items.length} session${items.length === 1 ? "" : "s"}.` +
          (missed.length ? ` Couldn't fill: ${missed.join(", ")}.` : "")
      );
    } catch (e) {
      console.error("[Plan] autoplan failed:", e);
      setPlanMsg("Couldn't plan the week — try again.");
    } finally {
      setPlanning(false);
    }
  }

  /** Move a scheduled workout to a different day. */
  async function moveWorkout(w: Workout, toDate: string) {
    if (!user) return;
    setMoving(null);
    setWorkouts((prev) =>
      (prev ?? []).map((x) => (x.id === w.id ? { ...x, date: toDate } : x))
    );
    await saveWorkout(user.uid, w.id, { date: toDate });
  }

  /**
   * Swap a day's main session for a different one, keeping its date and slot.
   * Implemented as delete-then-create because a workout's plannedSets are a
   * snapshot of the template taken at scheduling time — there's no in-place
   * "become this other template" that wouldn't just be the same two writes.
   */
  async function switchWorkout(w: Workout, template: WorkoutTemplate) {
    if (!user) return;
    setSwitching(null);
    setWorkouts((prev) => (prev ?? []).filter((x) => x.id !== w.id));
    // Swapping is a softer no than deleting, but still a no.
    if (w.status === "planned") {
      await recordTrainingSignal(user.uid, signalFor(w, "replaced"));
    }
    await deleteWorkout(user.uid, w.id);
    await startWorkoutFromTemplate(user.uid, template, {
      date: w.date,
      slot: w.slot ?? "strength",
    });
    await load();
  }

  async function updateGoal(kind: WorkoutKind, delta: number) {
    if (!user) return;
    const next = { ...goals, [kind]: Math.max(0, Math.min(14, goals[kind] + delta)) };
    setGoals(next);
    await saveWeeklyGoals(user.uid, next);
  }

  useEffect(() => {
    setWorkouts(null);
    load();
  }, [load]);

  async function removeWorkout(w: Workout) {
    if (!user) return;
    if (!confirm(`Remove "${w.title}" from ${prettyDay(w.date)}?`)) return;
    setWorkouts((prev) => (prev ?? []).filter((x) => x.id !== w.id));
    // Deleting a session you never started is the clearest "not this" there
    // is, and a hard delete would otherwise leave nothing to learn from.
    if (w.status === "planned") {
      await recordTrainingSignal(user.uid, signalFor(w, "deleted"));
    }
    await deleteWorkout(user.uid, w.id);
  }

  const byDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts ?? []) {
      if (!m.has(w.date)) m.set(w.date, []);
      m.get(w.date).push(w);
    }
    // morning-pt first, then strength, then anything untagged
    const rank = (w: Workout) => (w.slot === "morning-pt" ? 0 : w.slot === "strength" ? 1 : 2);
    for (const list of m.values()) list.sort((a, b) => rank(a) - rank(b));
    return m;
  }, [workouts]);

  const done = useMemo(() => countByKind(workouts ?? []), [workouts]);
  const planned = useMemo(() => plannedByKind(workouts ?? []), [workouts]);

  const stats = useMemo(() => {
    const all = workouts ?? [];
    const planned = all.filter((w) => w.status !== "skipped");
    const minutes = planned.reduce((sum, w) => sum + estimatePlannedMinutes(w), 0);
    const done = all.filter((w) => w.status === "completed").length;
    return { count: planned.length, minutes, done };
  }, [workouts]);

  /**
   * Tapping a day's workout opens its detail page, not the runner — you're
   * usually checking what's in it, not starting it from here. `from` lets that
   * page send you back to the week you were looking at instead of Today.
   */
  const detailHref = (w: Workout) =>
    `${w.status === "completed" ? "/history" : "/planned"}/${w.id}?from=/plan`;

  const totalDone = KINDS.reduce((n, k) => n + Math.min(done[k.key], goals[k.key]), 0);
  const totalGoal = KINDS.reduce((n, k) => n + goals[k.key], 0);

  if (workouts === null) return <PageSkeleton rows={6} />;

  const label =
    weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : weekOffset === -1 ? "Last week" : `${start} – ${end}`;

  return (
    <div className="space-y-4">
      {/* Title and week switcher share a row — they're both "which week am I
          looking at", and stacking them cost a third of the screen. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="shrink-0 text-[26px] font-bold leading-none tracking-[-0.02em]">
          Plan
        </h1>
        <div className="flex min-w-0 items-center gap-1">
          <ArrowButton dir="prev" onClick={() => setWeekOffset((w) => w - 1)} />
          <div className="min-w-0 text-center">
            <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {label}
            </div>
            <div className="text-[12px] tnum text-[color:var(--color-muted)]">
              {short(start)} – {short(end)}
            </div>
          </div>
          <ArrowButton dir="next" onClick={() => setWeekOffset((w) => w + 1)} />
        </div>
      </div>

      <section>
        <Group>
          <Row
            title="Weekly goals"
            subtitle={`${stats.count} scheduled · ${
              stats.minutes > 0 ? formatMinutes(stats.minutes) : "0 min"
            }`}
            value={`${totalDone}/${totalGoal}`}
            onClick={() => setGoalsOpen((v) => !v)}
            trailing={
              <svg
                className={`shrink-0 text-[color:var(--color-muted-2)] transition-transform ${
                  goalsOpen ? "rotate-180" : ""
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

        {goalsOpen && (
          <Card className="mt-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-[color:var(--color-muted)]">
                Targets for the week
              </span>
              <button
                type="button"
                onClick={() => setEditingGoals((v) => !v)}
                className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
              >
                {editingGoals ? "Done" : "Edit"}
              </button>
            </div>
            <div className="space-y-3.5">
              {KINDS.map((k) => (
                <GoalBar
                  key={k.key}
                  label={k.label}
                  hint={k.hint}
                  done={done[k.key]}
                  planned={planned[k.key]}
                  goal={goals[k.key]}
                  editing={editingGoals}
                  onChange={(d) => void updateGoal(k.key, d)}
                />
              ))}
            </div>
          </Card>
        )}
      </section>

      <LearnedSection
        prefs={prefs}
        open={showLearned}
        onToggle={() => setShowLearned((v) => !v)}
        onOfferAgain={(name) => void offerAgain(name)}
      />

      {/* Label follows the week you're looking at — otherwise "Plan my week"
          on next week's view reads like it'd fill this one. */}
      <div className="flex items-center gap-3 text-[15px]">
        <button
          onClick={planWeek}
          disabled={planning}
          className="text-[color:var(--color-accent)] active:opacity-60 disabled:opacity-30"
        >
          {planning
            ? "Planning…"
            : weekOffset === 0
            ? "Auto-plan this week"
            : weekOffset === 1
            ? "Auto-plan next week"
            : `Auto-plan ${short(start)}`}
        </button>
        <span className="text-[color:var(--color-muted-2)]">·</span>
        <Link to={`/log-class?date=${today}`} className="text-[color:var(--color-accent)] active:opacity-60">
          Log a class
        </Link>
      </div>
      {planMsg && (
        <p className="text-[13px] text-[color:var(--color-muted)]">{planMsg}</p>
      )}

      <div className="space-y-4">
        {leadDays.map((date) => (
          <DayRow
            key={date}
            dayName={dayName(date)}
            date={date}
            isToday={date === today}
            isPast={date < today}
            workouts={byDate.get(date) ?? []}
            onRemove={removeWorkout}
            onMove={setMoving}
            onSwitch={setSwitching}
            onOpen={(w) => nav(detailHref(w))}
          />
        ))}

        {pastDays.length > 0 && (
          <>
            <SectionHeader title="Earlier this week" className="pt-2" />
            {pastDays.map((date) => (
              <DayRow
                key={date}
                dayName={dayName(date)}
                date={date}
                isToday={false}
                isPast
                workouts={byDate.get(date) ?? []}
                onRemove={removeWorkout}
                onMove={setMoving}
                onSwitch={setSwitching}
                onOpen={(w) => nav(detailHref(w))}
              />
            ))}
          </>
        )}
      </div>

      <p className="pt-1 text-center text-[13px] text-[color:var(--color-muted-2)]">
        Scheduled workouts show up on Today when the day arrives.
      </p>

      {moving && (
        <MoveSheet
          workout={moving}
          days={days}
          dayNames={DAY_NAMES}
          onPick={(d) => void moveWorkout(moving, d)}
          onClose={() => setMoving(null)}
        />
      )}

      {switching && (
        <SwitchSheet
          workout={switching}
          templates={templates}
          onPick={(t) => void switchWorkout(switching, t)}
          onClose={() => setSwitching(null)}
        />
      )}
    </div>
  );
}

/**
 * Bottom sheet for swapping a day's main session.
 *
 * The two tabs are the choice the user actually makes — a gym session or a
 * Cindy-style AMRAP — rather than the app's five internal kinds. Home strength
 * sits under "Gym" because from the planner's point of view it's the same
 * decision: lift, or do conditioning.
 */
function SwitchSheet({
  workout,
  templates,
  onPick,
  onClose,
}: {
  workout: Workout;
  templates: WorkoutTemplate[];
  onPick: (t: WorkoutTemplate) => void;
  onClose: () => void;
}) {
  const current = kindOf(workout);
  const [tab, setTab] = useState<"gym" | "amrap">(current === "amrap" ? "amrap" : "gym");

  const options = useMemo(() => {
    const wanted = (t: WorkoutTemplate) => {
      const k = kindOf({ title: t.name, focus: t.focus, category: t.category, format: t.format });
      return tab === "amrap" ? k === "amrap" : k === "gym" || k === "home";
    };
    return templates
      .filter((t) => !t.archived && wanted(t))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, tab]);

  return (
    <Sheet onClose={onClose} label={`Switch ${workout.title}`}>
      <SheetHeader title="Switch session" onCancel={onClose} />
      <div className="flex min-h-0 flex-col overflow-hidden px-4 pb-6">
        {/* shrink-0: this sits in a flex column whose list child grows, and
            without it the flexbox squashes the line to a few pixels tall. */}
        <p className="mb-3 shrink-0 truncate text-[13px] text-[color:var(--color-muted)]">
          {prettyDay(workout.date)} · currently {workout.title}
        </p>
        <div className="shrink-0">
          <Segmented<"gym" | "amrap">
            value={tab}
            onChange={setTab}
            options={[
              { value: "gym", label: "Gym" },
              { value: "amrap", label: "Cindy style" },
            ]}
          />
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-[color:var(--color-muted)]">
              No {tab === "amrap" ? "AMRAP" : "gym"} routines in your library yet.
            </p>
          ) : (
            <Group>
              {options.map((t) => {
                const isCurrent = t.name === workout.title;
                return (
                  <Row
                    key={t.id}
                    title={t.name}
                    subtitle={t.focus}
                    value={isCurrent ? "Current" : formatMinutes(estimatePlannedMinutes(t))}
                    onClick={isCurrent ? undefined : () => onPick(t)}
                    trailing={isCurrent ? <CheckMark /> : undefined}
                  />
                );
              })}
            </Group>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * What the planner has worked out from what you actually did.
 *
 * Collapsed by default and hidden entirely until there's something to say —
 * but never hidden once there is. Silently dropping a routine, with no way to
 * see it happened or undo it, would be the worst version of this feature.
 */
function LearnedSection({
  prefs,
  open,
  onToggle,
  onOfferAgain,
}: {
  prefs: Preferences;
  open: boolean;
  onToggle: () => void;
  onOfferAgain: (name: string) => void;
}) {
  const stopped = prefs.evidence.filter((e) => prefs.isRejected(e.name));
  const dropped = [...prefs.droppedByTemplate.entries()];
  const favourites = prefs.evidence.filter((e) => e.score >= 2).slice(-3).reverse();
  const total = stopped.length + dropped.length + favourites.length;
  if (!total) return null;

  return (
    <section>
      <SectionHeader
        title="What I've learned"
        action={
          <button
            onClick={onToggle}
            className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
          >
            {open ? "Hide" : `${total}`}
          </button>
        }
      />
      {open && (
        <Card>
          <div className="space-y-3 text-[13px] leading-snug">
            {stopped.length > 0 && (
              <div>
                <div className="mb-1.5 text-[color:var(--color-muted)]">
                  No longer suggesting
                </div>
                <Group>
                  {stopped.map((e) => (
                    <Row
                      key={e.name}
                      title={e.name}
                      subtitle={`You dropped this ${e.rejected} time${
                        e.rejected === 1 ? "" : "s"
                      }`}
                      trailing={
                        <button
                          onClick={() => onOfferAgain(e.name)}
                          className="shrink-0 text-[15px] text-[color:var(--color-accent)] active:opacity-60"
                        >
                          Offer again
                        </button>
                      }
                    />
                  ))}
                </Group>
              </div>
            )}
            {dropped.length > 0 && (
              <div>
                <div className="mb-1.5 text-[color:var(--color-muted)]">
                  Leaving out
                </div>
                <Group>
                  {dropped.map(([template, exercises]) => (
                    <Row
                      key={template}
                      title={[...exercises].join(", ")}
                      subtitle={`from ${template}`}
                    />
                  ))}
                </Group>
              </div>
            )}
            {favourites.length > 0 && (
              <div className="text-[color:var(--color-muted)]">
                Favouring {favourites.map((f) => f.name).join(", ")} — you keep
                finishing {favourites.length === 1 ? "it" : "them"}.
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

/**
 * Adjust a freshly scheduled workout to match how you actually train it./**
 * Adjust a freshly scheduled workout to match how you actually train it.
 *
 * Returns the patch, or null when nothing needs changing — the common case
 * once a routine has settled, and worth skipping so the planner isn't writing
 * every document twice.
 */
function tailorToHistory(
  template: WorkoutTemplate,
  workoutId: string,
  history: Workout[],
  preferences: ReturnType<typeof derivePreferences>
): { plannedSets: PlannedSet[] } | null {
  const drop = preferences.dropped(template.name);
  let sets = template.plannedSets.map((s, i) => ({ ...s, order: i + 1 }));

  if (drop.size) {
    const kept = sets.filter((s) => !drop.has(s.exerciseName));
    // Never empty the session. If your edits would remove everything, the
    // routine itself is the problem and deleting it is the honest fix.
    if (kept.length) sets = kept.map((s, i) => ({ ...s, order: i + 1 }));
  }

  // Double progression off the last completed session for each exercise.
  // suggestTargets skips timed work and anything it has no history for, so a
  // brand-new exercise keeps the template's numbers.
  const asWorkout: Workout = {
    id: workoutId,
    date: "",
    title: template.name,
    focus: template.focus,
    status: "planned",
    plannedSets: sets,
  };
  const suggestions = suggestTargets(asWorkout, history).filter((s) => s.changed);
  if (suggestions.length) sets = applyTargets(sets, suggestions);

  const unchanged =
    sets.length === template.plannedSets.length &&
    sets.every((s, i) => {
      const o = template.plannedSets[i];
      return (
        s.exerciseName === o.exerciseName &&
        s.targetReps === o.targetReps &&
        s.targetWeight === o.targetWeight
      );
    });
  return unchanged ? null : { plannedSets: sets };
}

/** Bottom sheet for moving a workout to a different day of the week. */
function MoveSheet({
  workout,
  days,
  dayNames,
  onPick,
  onClose,
}: {
  workout: Workout;
  days: string[];
  dayNames: string[];
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} label={`Move ${workout.title}`}>
      <SheetHeader title="Move to" onCancel={onClose} />
      <div className="overflow-y-auto px-4 pb-6">
        <p className="mb-3 truncate text-[13px] text-[color:var(--color-muted)]">
          {workout.title}
        </p>
        <Group>
          {days.map((d, i) => {
            const current = d === workout.date;
            return (
              <Row
                key={d}
                title={dayNames[i]}
                value={current ? "Currently here" : short(d)}
                onClick={current ? undefined : () => onPick(d)}
                trailing={current ? <CheckMark /> : undefined}
              />
            );
          })}
        </Group>
      </div>
    </Sheet>
  );
}

function CheckMark() {
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

/* ------------------------------- Day row ------------------------------- */

function DayRow({
  dayName,
  date,
  isToday,
  isPast,
  workouts,
  onRemove,
  onMove,
  onSwitch,
  onOpen,
}: {
  dayName: string;
  date: string;
  isToday: boolean;
  isPast: boolean;
  workouts: Workout[];
  onRemove: (w: Workout) => void;
  onMove: (w: Workout) => void;
  onSwitch: (w: Workout) => void;
  onOpen: (w: Workout) => void;
}) {
  return (
    <section className={isPast && !isToday ? "opacity-50" : ""}>
      <SectionHeader
        title={dayName}
        action={
          <span className="flex items-center gap-2.5">
            <span className="text-[13px] tnum text-[color:var(--color-muted)]">
              {isToday ? "Today" : short(date)}
            </span>
            <Link
              to={`/library?date=${date}`}
              aria-label={`Add a workout on ${dayName}`}
              className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
            >
              Add
            </Link>
          </span>
        }
      />
      {workouts.length === 0 ? (
        <Group>
          <Row
            to={`/library?date=${date}`}
            title={<span className="text-[color:var(--color-muted)]">Rest day</span>}
            trailing={
              <span className="text-[15px] text-[color:var(--color-accent)]">Schedule</span>
            }
          />
        </Group>
      ) : (
        <Group>
          {workouts.map((w) => (
            <PlannedRow
              key={w.id}
              workout={w}
              onRemove={onRemove}
              onMove={onMove}
              onSwitch={onSwitch}
              onOpen={onOpen}
            />
          ))}
        </Group>
      )}
    </section>
  );
}

function PlannedRow({
  workout: w,
  onRemove,
  onMove,
  onSwitch,
  onOpen,
}: {
  workout: Workout;
  onRemove: (w: Workout) => void;
  onMove: (w: Workout) => void;
  onSwitch: (w: Workout) => void;
  onOpen: (w: Workout) => void;
}) {
  // Key off the slot, which is what the planner and the switcher both set.
  // Falling back to category made a PT-categorised AMRAP scheduled as a main
  // session look like the fixed morning opener — no switch button, wrong dot.
  // Category is only consulted for legacy docs written before slots existed.
  const isPT = w.slot ? isMorningSlot(w.slot) : w.category === "PT Only";
  const done = w.status === "completed";
  // Switching throws the old doc away, so only offer it while there's nothing
  // to throw away. Once a set is logged, Remove (which confirms) is the way out.
  const untouched =
    w.status === "planned" && !w.plannedSets.some((s) => s.completedAt);
  const mins = estimatePlannedMinutes(w);
  return (
    <Row
      onClick={() => onOpen(w)}
      leading={
        <span
          className={`block size-2 shrink-0 rounded-full ${
            done
              ? "bg-[color:var(--color-success)]"
              : isPT
              ? "bg-[color:var(--color-info)]"
              : "bg-[color:var(--color-accent)]"
          }`}
        />
      }
      title={w.title}
      subtitle={`${w.plannedSets.length} sets · ~${formatMinutes(mins)}${done ? " · done" : ""}`}
      trailing={
        !done && (
          // Move / remove stay on the row rather than behind a menu — the
          // whole point of this screen is shuffling the week around.
          <span className="flex shrink-0 items-center">
            {/* Swapping gym for Cindy-style is the edit you make most often,
                so it sits on the row rather than behind the day's Add link.
                The morning routine isn't swappable — it's the fixed opener. */}
            {!isPT && untouched && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwitch(w);
                }}
                aria-label={`Switch ${w.title} for a different session`}
                className="grid size-9 place-items-center text-[color:var(--color-muted-2)] active:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(w);
              }}
              aria-label={`Move ${w.title} to another day`}
              className="grid size-9 place-items-center text-[color:var(--color-muted-2)] active:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 11 21 7 17 3" />
                <line x1="21" y1="7" x2="9" y2="7" />
                <polyline points="7 13 3 17 7 21" />
                <line x1="15" y1="17" x2="3" y2="17" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(w);
              }}
              aria-label={`Remove ${w.title}`}
              className="grid size-9 place-items-center text-[color:var(--color-muted-2)] active:text-[color:var(--color-danger)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        )
      }
    />
  );
}

/* -------------------------------- Bits --------------------------------- */

/**
 * One goal row: filled segments for completed, outlined for merely scheduled,
 * so you can see at a glance whether the week is *planned* to hit the target
 * versus already there.
 */
function GoalBar({
  label,
  hint,
  done,
  planned,
  goal,
  editing,
  onChange,
}: {
  label: string;
  hint: string;
  done: number;
  planned: number;
  goal: number;
  editing: boolean;
  onChange: (delta: number) => void;
}) {
  const hit = done >= goal && goal > 0;
  const segments = Math.max(goal, planned, 1);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] tracking-[-0.01em]">{label}</div>
          <div className="text-[13px] text-[color:var(--color-muted-2)]">{hint}</div>
        </div>
        {editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <StepBtn label="−" onClick={() => onChange(-1)} />
            <span className="w-5 text-center text-[15px] font-medium tnum">{goal}</span>
            <StepBtn label="+" onClick={() => onChange(1)} />
          </div>
        ) : (
          <div className="shrink-0 text-[15px] tnum text-[color:var(--color-muted)]">
            <span className={hit ? "text-[color:var(--color-success)]" : "text-white"}>
              {done}
            </span>
            {" / "}
            {goal}
          </div>
        )}
      </div>
      {/* Segments: solid = done, faint = merely scheduled. Lets you see
          whether the week is *planned* to hit target versus already there. */}
      <div className="mt-2 flex gap-1">
        {Array.from({ length: segments }, (_, i) => {
          const isDone = i < done;
          const isPlanned = !isDone && i < planned;
          return (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                isDone
                  ? hit
                    ? "bg-[color:var(--color-success)]"
                    : "bg-[color:var(--color-accent)]"
                  : isPlanned
                  ? "bg-[color:var(--color-accent)]/35"
                  : "bg-[color:var(--color-surface-3)]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full bg-[color:var(--color-surface-2)] text-[15px] text-[color:var(--color-accent)] active:bg-[color:var(--color-surface-3)]"
    >
      {label}
    </button>
  );
}

function ArrowButton({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous week" : "Next week"}
      className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--color-accent)] active:opacity-60"
    >
      <svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <polyline points="9 1.5 2 9 9 16.5" /> : <polyline points="2 1.5 9 9 2 16.5" />}
      </svg>
    </button>
  );
}

/* ------------------------------- Helpers ------------------------------- */

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}
/** "2026-08-12" → "8/12" */
function short(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}
function prettyDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
}
