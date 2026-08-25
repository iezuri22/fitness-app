/**
 * Auto-planner — fills a week so every day has a morning opener and one main
 * session.
 *
 * The shape of a day is fixed:
 *   1. A morning stretch / shoulder routine. Every day, no exceptions — it's
 *      five to ten minutes and it's the part that keeps the shoulder working.
 *   2. One main session, which is either a gym workout or a Cindy-style AMRAP.
 *
 * How the main session is chosen, in order:
 *   - If a template names this weekday ("Gym · Wed — Quads + Core"), that's the
 *     one. A named split IS the plan; the planner shouldn't second-guess it.
 *   - Otherwise fall back to the weekly goals: gym sessions spread across the
 *     week up to the gym target, then home strength up to its target.
 *   - Every remaining day gets an AMRAP, so no day is left empty.
 *
 * It never overwrites. A day that already has a main session keeps it and only
 * gains a morning opener if one is missing, which means you can re-run this
 * after hand-picking a couple of days and it fills the gaps around them.
 *
 * Returns a plan for the caller to write; it performs no I/O itself so it can
 * be reasoned about and previewed before anything is committed.
 */
import type { Workout, WorkoutTemplate } from "./types";
import { kindOf, type WeeklyGoals, type WorkoutKind } from "./weeklyGoals";
import { slotOrder, type SlotName } from "./slots";
import { estimatePlannedMinutes } from "./timeEstimate";

export interface PlannedItem {
  date: string;
  template: WorkoutTemplate;
  kind: WorkoutKind;
  /** Which part of the day this fills. */
  slot: SlotName;
}

export interface AutoPlanResult {
  items: PlannedItem[];
  /** Goals we couldn't fully satisfy, e.g. no gym templates in the library. */
  shortfalls: { kind: WorkoutKind; wanted: number; got: number }[];
}

/** Kinds that can serve as a day's main session. PT never does — it's the opener. */
const MAIN_KINDS: WorkoutKind[] = ["gym", "amrap", "home", "class"];

/** What the morning PT slot is budgeted for. */
const PT_TARGET_MIN = 10;

const WEEKDAY_ABBR = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_FULL = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

/**
 * The weekday a template pins itself to, or null.
 *
 * Full names match anywhere — "Mobility Monday" can only mean Monday. The
 * three-letter abbreviations are riskier, because "sun" and "sat" are ordinary
 * words, so they only count in a name that uses the pack's structured format
 * ("Gym · Sat — Posterior Chain"). That way a yoga routine called
 * "Sun Salutation" doesn't quietly become a Sunday fixture.
 *
 * Matched as whole words throughout, so "Summer Shred" and "Band Monster Walk"
 * pin to nothing.
 */
export function weekdayOf(t: Pick<WorkoutTemplate, "name">): number | null {
  const words = t.name.toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ");
  for (const w of words) {
    const full = WEEKDAY_FULL.indexOf(w);
    if (full >= 0) return full;
  }
  const structured = /[·—]/.test(t.name);
  if (!structured) return null;
  for (const w of words) {
    const abbr = WEEKDAY_ABBR.indexOf(w);
    if (abbr >= 0) return abbr;
  }
  return null;
}

/**
 * Morning openers, best first. The ask is a "stretch / shoulder" routine, so
 * the AM-prefixed ones win, then anything shoulder- or mobility-shaped, then
 * any remaining PT session rather than leaving the slot empty.
 */
function openerRank(t: WorkoutTemplate): number {
  const hay = `${t.name} ${t.focus}`.toLowerCase();
  // An evening wind-down is the wrong way to start a day, however
  // shoulder-shaped it is. Rank it below everything else rather than
  // excluding it, so a library of only PM routines still fills the slot.
  if (/^pm ·|evening|night|wind.?down|bed/.test(hay)) return 4;
  // Some routines only declare their timing in the notes — "Good in the
  // evening." Matched with a much narrower pattern than the name check,
  // because prose mentions the time of day in passing: "Straight out of bed"
  // opens the 5-minute morning routine, and a bare /bed/ would demote it.
  if (/\bevening\b|before bed|bedtime/i.test(t.notes ?? "")) return 4;
  if (/^am ·/.test(t.name.toLowerCase())) return 0;
  if (/shoulder|rotator|scap|cuff/.test(hay)) return 1;
  if (/stretch|mobility|wake|primer|posture/.test(hay)) return 2;
  return 3;
}

/**
 * Does this routine actually work the shoulder?
 *
 * Read off the movements rather than the name, because the name is a label and
 * the shoulder work is the entire point of the slot. "Stretch · 10 min Lower
 * Body" reads like a fine morning stretch and contains no upper body at all.
 */
const SHOULDER_WORK =
  new RegExp(
    [
      // Cuff, directly.
      "external rotation", "internal rotation", "rotator", "cuff", "sleeper",
      // Scapular control, including the prone series — a prone Y raise is
      // lower-trap work and belongs here even though it names neither.
      "scapular", "scap ", "wall slide", "pull.?apart", "serratus",
      "prone [ytwi] ", "prone swimmer", "scaption", "face pull", "retraction",
      // Range and the joint itself.
      "shoulder", "pulley", "overhead reach", "distraction", "cars",
      // Soft tissue around it.
      "doorway chest", "cross.?body", "thread the needle",
    ].join("|"),
    "i"
  );

/**
 * Fraction of a routine's sets that are shoulder work. Used to put the
 * dedicated rehab sessions ahead of a general mobility flow that happens to
 * contain one chest stretch — both pass hasShoulderWork, but only one of them
 * is "PT for my shoulder".
 */
function shoulderShare(t: WorkoutTemplate): number {
  const sets = t.plannedSets ?? [];
  if (!sets.length) return 0;
  return sets.filter((s) => SHOULDER_WORK.test(s.exerciseName)).length / sets.length;
}

function hasShoulderWork(t: WorkoutTemplate): boolean {
  return (t.plannedSets ?? []).some((s) => SHOULDER_WORK.test(s.exerciseName));
}

/**
 * When you only get a couple of gym days a week, they should be the big
 * sessions — not an arms day and a sled finisher. Lower score = picked first.
 */
const PRIORITY: [RegExp, number][] = [
  [/full body|power build|density/i, 0],
  [/leg|quad|hinge|lower|posterior/i, 1],
  [/push|chest|pressure/i, 1],
  [/pull|back|wingspan/i, 1],
  [/upper/i, 2],
  [/delt|shoulder/i, 3],
  [/arm|sleeve|bicep|tricep/i, 4],
  [/core|brace/i, 4],
  [/conditioning|sled|carry|express|boxing/i, 5],
];
function priorityOf(t: WorkoutTemplate): number {
  const hay = `${t.name} ${t.focus}`;
  for (const [re, score] of PRIORITY) if (re.test(hay)) return score;
  return 2;
}

/** Rough movement bias, so two leg days don't land side by side. */
function patternOf(t: WorkoutTemplate): string {
  const hay = `${t.name} ${t.focus}`.toLowerCase();
  if (/leg|quad|hinge|glute|lower|squat|posterior/.test(hay)) return "legs";
  if (/pull|back|row|wingspan/.test(hay)) return "pull";
  if (/push|chest|press|delt|shoulder/.test(hay)) return "push";
  if (/arm|sleeve|bicep|tricep/.test(hay)) return "arms";
  if (/core|brace|abs/.test(hay)) return "core";
  return "full";
}

/**
 * Deterministic per-week ordering key. Not random: the same name in the same
 * week always sorts the same way, so re-planning a week is stable and the plan
 * can be reasoned about, while the next week comes out in a different order.
 */
function weekJitter(name: string, weekKey: string): number {
  const s = `${weekKey}:${name}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Order candidate days so the requested count spreads across the week instead
 * of clumping. For 2 sessions over 7 open days you want something like Mon/Thu,
 * not Mon/Tue.
 */
function spread(days: string[], count: number): string[] {
  if (count <= 0 || !days.length) return [];
  if (count >= days.length) return [...days];
  const picked: string[] = [];
  const step = days.length / count;
  for (let i = 0; i < count; i++) {
    picked.push(days[Math.min(days.length - 1, Math.round(i * step))]);
  }
  return [...new Set(picked)];
}

export function autoPlanWeek(opts: {
  /** Mon→Sun dates for the week being planned. */
  days: string[];
  /** What's already scheduled, so we fill around it instead of over it. */
  existing: Pick<Workout, "date" | "title" | "focus" | "category" | "format" | "slot" | "status">[];
  goals: WeeklyGoals;
  templates: WorkoutTemplate[];
  /** Template names used recently, so the plan varies week to week. */
  recentNames?: Set<string>;
  /** Don't schedule anything before this date (usually today). */
  notBefore?: string;
}): AutoPlanResult {
  const { days, existing, goals, templates, recentNames = new Set(), notBefore } = opts;

  // A day is only "covered" by something that still counts — a skipped workout
  // leaves the slot open again.
  const hasStretch = new Set<string>();
  const hasPT = new Set<string>();
  const hasMain = new Set<string>();
  // Sessions already on the week count against the weekly goals. Without this,
  // re-planning on a Saturday sees "0 strength days assigned so far" and books
  // another one, on top of the four you already did.
  let existingStrength = 0;
  for (const w of existing) {
    if (w.status === "skipped") continue;
    const k = kindOf(w);
    // Prefer the slot the doc actually carries; fall back to shape for legacy
    // entries written before the day had three parts.
    if (w.slot === "morning-stretch" || (!w.slot && w.format === "flow")) {
      hasStretch.add(w.date);
    } else if (w.slot === "morning-pt" || (!w.slot && k === "pt")) {
      hasPT.add(w.date);
    } else {
      hasMain.add(w.date);
    }
    if (k === "gym" || k === "home") existingStrength++;
  }

  const plannable = days.filter((d) => !notBefore || d >= notBefore);

  const active = templates.filter((t) => !t.archived);
  const byKind = new Map<WorkoutKind, WorkoutTemplate[]>();
  for (const t of active) {
    const k = kindOf({ title: t.name, focus: t.focus, category: t.category, format: t.format });
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(t);
  }
  for (const list of byKind.values()) {
    list.sort((a, b) => {
      // Not done recently wins first, then the meatier session, then name for
      // a stable order.
      const r = Number(recentNames.has(a.name)) - Number(recentNames.has(b.name));
      if (r !== 0) return r;
      const p = priorityOf(a) - priorityOf(b);
      if (p !== 0) return p;
      return a.name.localeCompare(b.name);
    });
  }

  const items: PlannedItem[] = [];
  const shortfalls: AutoPlanResult["shortfalls"] = [];

  // ---- 1. Morning opener on every day that lacks one -------------------
  //
  // The pool is defined by CONTENT, not by name. An earlier version ranked by
  // naming convention and took everything that looked morning-ish, which let
  // hip, ankle and lower-body flows take the slot — 29% of mornings ended up
  // with no upper-body work at all. This slot exists to keep the shoulder
  // working, so a routine qualifies by containing shoulder work.
  //
  // Rank now only answers "is this an evening routine?". Both fallbacks exist
  // so a library without the ideal templates still gets its days filled.
  const ptTemplates = byKind.get("pt") ?? [];
  const notEvening = ptTemplates.filter((t) => openerRank(t) < 4);

  // Two sources of variety, in order. Recency cycles through a pool so a
  // fortnight's worth are all different. Once a pool is smaller than the
  // lookback everything reads as "recent" and recency stops discriminating,
  // so a per-week shuffle takes over. Keyed off the week's Monday, so it is
  // stable if you re-plan the same week and different for the next one.
  const weekKey = days[0] ?? "";
  const varied = (pool: WorkoutTemplate[]) =>
    [...pool].sort((a, b) => {
      const r = Number(recentNames.has(a.name)) - Number(recentNames.has(b.name));
      if (r !== 0) return r;
      return weekJitter(a.name, weekKey) - weekJitter(b.name, weekKey);
    });

  const fill = (
    dates: string[],
    pool: WorkoutTemplate[],
    slot: PlannedItem["slot"]
  ) => {
    if (!dates.length) return;
    if (!pool.length) {
      shortfalls.push({ kind: "pt", wanted: dates.length, got: 0 });
      return;
    }
    dates.forEach((date, i) => {
      items.push({ date, template: pool[i % pool.length], kind: "pt", slot });
    });
  };

  // 1a. The five-minute stretch. Guided flows run to a clock and auto-advance,
  //     which is what makes them a timer you follow rather than a list you
  //     read — exactly the thing to start on before you're properly awake.
  const flows = notEvening.filter((t) => t.format === "flow");
  const shortFlows = flows.filter((t) => (t.capMinutes ?? 99) <= 5);
  // Prefer the full-body flows. A morning should move everything, weighted to
  // hips and spine — the bits a night's sleep and a day at a desk stiffen most.
  // The narrower ones (shoulders only, hips only) stay in the library to pick
  // by hand on a day something specific is complaining, but they're the wrong
  // default because they leave most of you untouched.
  const fullBody = shortFlows.filter((t) => /full body/i.test(t.focus));
  const stretchPool = fullBody.length
    ? fullBody
    : shortFlows.length
    ? shortFlows
    : flows;
  fill(
    plannable.filter((d) => !hasStretch.has(d)),
    varied(stretchPool),
    "morning-stretch"
  );

  // 1b. The shoulder work. Everything here has cuff or scap content — that's
  //     the whole point of the slot — and the most shoulder-dominant routines
  //     sort first, so a general mobility session is only reached when the
  //     dedicated rehab ones are used up.
  const ptCandidates = notEvening.filter(
    (t) => t.format !== "flow" && hasShoulderWork(t)
  );
  const ptPool = ptCandidates.length
    ? ptCandidates
    : notEvening.filter((t) => t.format !== "flow");
  // Order by fitness for the slot, then vary within each band. The slot is
  // "ten minutes of shoulder PT", so a routine earns its place by being close
  // to ten minutes AND mostly shoulder work — a six-minute desk reset is a
  // fine routine and the wrong answer here. Sorting on a banded score rather
  // than the raw numbers leaves ties for the shuffle to break, which is what
  // keeps the week from being identical to the last one.
  const ptFit = (t: WorkoutTemplate) => {
    const mins = estimatePlannedMinutes(t);
    const nearTen = Math.min(3, Math.round(Math.abs(mins - PT_TARGET_MIN) / 2));
    const shoulder = 3 - Math.min(3, Math.round(shoulderShare(t) * 3));
    return nearTen * 4 + shoulder;
  };
  const ptOrdered = varied(ptPool).sort((a, b) => ptFit(a) - ptFit(b));
  fill(plannable.filter((d) => !hasPT.has(d)), ptOrdered, "morning-pt");

  // ---- 2. One main session on every day that lacks one -----------------
  const needMain = plannable.filter((d) => !hasMain.has(d));
  const usedNames = new Set<string>();
  const assigned = new Map<string, { template: WorkoutTemplate; kind: WorkoutKind }>();

  const mainPool = MAIN_KINDS.flatMap((k) => (byKind.get(k) ?? []).map((t) => ({ t, k })));

  // 2a. Weekday-pinned templates win outright.
  for (const date of needMain) {
    const weekday = days.indexOf(date);
    if (weekday < 0) continue;
    const pinned = mainPool.find(({ t }) => weekdayOf(t) === weekday && !usedNames.has(t.name));
    if (pinned) {
      assigned.set(date, { template: pinned.t, kind: pinned.k });
      usedNames.add(pinned.t.name);
    }
  }

  // 2b. Goal-driven strength days across whatever's left.
  //
  // Gym and home targets are pooled into one "lifting days" number and drawn
  // gym-first. Treating them as separate quotas meant a leftover home target
  // would plant a full strength session on the one day still free — which,
  // after a weekday-pinned split has taken Mon-Sat, is Sunday. Sunday should
  // be the easy day, and under 2c it becomes one.
  const strengthWant = (goals.gym ?? 0) + (goals.home ?? 0);
  const alreadyStrength =
    existingStrength +
    [...assigned.values()].filter((a) => a.kind === "gym" || a.kind === "home").length;
  const remaining = strengthWant - alreadyStrength;
  if (remaining > 0) {
    const pool = [...(byKind.get("gym") ?? []), ...(byKind.get("home") ?? [])].filter(
      (t) => weekdayOf(t) === null
    );
    const free = needMain.filter((d) => !assigned.has(d));
    if (!pool.length) {
      shortfalls.push({ kind: "gym", wanted: strengthWant, got: alreadyStrength });
    } else {
      for (const date of spread(free, Math.min(remaining, free.length))) {
        const prev = assigned.get(previousDay(date, days) ?? "");
        const prevPattern = prev ? patternOf(prev.template) : null;
        const fresh = pool.filter((t) => !usedNames.has(t.name));
        const list = fresh.length ? fresh : pool;
        const pick = list.find((t) => patternOf(t) !== prevPattern) ?? list[0];
        if (!pick) break;
        const k = kindOf({ title: pick.name, focus: pick.focus, category: pick.category, format: pick.format });
        assigned.set(date, { template: pick, kind: k });
        usedNames.add(pick.name);
      }
    }
  }

  // 2c. Everything still empty becomes an AMRAP — that's the "or a Cindy-style
  //     workout" half of the rule, and it's what stops a day being blank.
  const amrapPool = (byKind.get("amrap") ?? []).filter((t) => weekdayOf(t) === null);
  const stillEmpty = needMain.filter((d) => !assigned.has(d));
  if (stillEmpty.length) {
    if (!amrapPool.length) {
      shortfalls.push({ kind: "amrap", wanted: stillEmpty.length, got: 0 });
    } else {
      const isEasy = (t: WorkoutTemplate) =>
        /easy|recovery|gentle|light/i.test(`${t.name} ${t.focus}`);
      stillEmpty.forEach((date, i) => {
        const fresh = amrapPool.filter((t) => !usedNames.has(t.name));
        const list = fresh.length ? fresh : amrapPool;
        // The last day of the week is the one you most need to come back from,
        // so give it an easy AMRAP when the library has one.
        const lastDay = date === days[days.length - 1];
        const pick =
          (lastDay ? list.find(isEasy) : undefined) ??
          (fresh.length ? list[0] : list[i % list.length]);
        assigned.set(date, { template: pick, kind: "amrap" });
        usedNames.add(pick.name);
      });
    }
  }

  for (const [date, a] of assigned) {
    items.push({ date, template: a.template, kind: a.kind, slot: "strength" });
  }

  items.sort(
    (a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot)
  );
  return { items, shortfalls };
}

function previousDay(date: string, days: string[]): string | null {
  const i = days.indexOf(date);
  return i > 0 ? days[i - 1] : null;
}
