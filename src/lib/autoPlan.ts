/**
 * Auto-planner — fills a week from your weekly goals.
 *
 * Rules it follows, roughly in the order a coach would:
 *   - Never touch a day that already has something scheduled or completed.
 *   - Gym days get spread out, never back-to-back if there's room.
 *   - Don't repeat the same session twice in a week while alternatives exist,
 *     and rotate away from what you did last week.
 *   - Strength sessions rotate through movement patterns (push / pull / legs)
 *     rather than stacking two leg days together.
 *   - PT is short enough to sit alongside anything, so it fills every remaining
 *     day rather than consuming one.
 *
 * Returns a plan for the caller to write; it performs no I/O itself so it can
 * be unit-reasoned about and previewed before anything is committed.
 */
import type { WorkoutTemplate } from "./types";
import { kindOf, type WeeklyGoals, type WorkoutKind } from "./weeklyGoals";

export interface PlannedItem {
  date: string;
  template: WorkoutTemplate;
  kind: WorkoutKind;
}

export interface AutoPlanResult {
  items: PlannedItem[];
  /** Goals we couldn't fully satisfy, e.g. no gym templates in the library. */
  shortfalls: { kind: WorkoutKind; wanted: number; got: number }[];
}

/**
 * When you only get 2 gym days a week, they should be the big sessions — not
 * an arms day and a sled finisher. Lower score = picked first.
 */
const PRIORITY: [RegExp, number][] = [
  [/full body|power build|density/i, 0],
  [/leg|quad|hinge|lower/i, 1],
  [/push|chest|pressure/i, 1],
  [/pull|back|wingspan/i, 1],
  [/upper/i, 2],
  [/delt|shoulder/i, 3],
  [/arm|sleeve|bicep|tricep/i, 4],
  [/core|brace/i, 4],
  [/conditioning|sled|carry|express/i, 5],
];
function priorityOf(t: WorkoutTemplate): number {
  const hay = `${t.name} ${t.focus}`;
  for (const [re, score] of PRIORITY) if (re.test(hay)) return score;
  return 2;
}

/** Rough movement bias, so two leg days don't land side by side. */
function patternOf(t: WorkoutTemplate): string {
  const hay = `${t.name} ${t.focus}`.toLowerCase();
  if (/leg|quad|hinge|glute|lower|squat/.test(hay)) return "legs";
  if (/pull|back|row|wingspan/.test(hay)) return "pull";
  if (/push|chest|press|delt|shoulder/.test(hay)) return "push";
  if (/arm|sleeve|bicep|tricep/.test(hay)) return "arms";
  if (/core|brace|abs/.test(hay)) return "core";
  return "full";
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
  /** Dates that already have a workout — left untouched. */
  busyDates: Set<string>;
  goals: WeeklyGoals;
  templates: WorkoutTemplate[];
  /** Template names used recently, so the plan varies week to week. */
  recentNames?: Set<string>;
  /** Don't schedule anything before this date (usually today). */
  notBefore?: string;
}): AutoPlanResult {
  const { days, busyDates, goals, templates, recentNames = new Set(), notBefore } = opts;

  const openDays = days.filter(
    (d) => !busyDates.has(d) && (!notBefore || d >= notBefore)
  );

  const active = templates.filter((t) => !t.archived);
  const byKind = new Map<WorkoutKind, WorkoutTemplate[]>();
  for (const t of active) {
    const k = kindOf({ title: t.name, focus: t.focus, category: t.category, format: t.format });
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(t);
  }
  // Prefer things not done recently; stable-sort by name so it's deterministic.
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
  const taken = new Set<string>();
  const usedNames = new Set<string>();

  // Hard sessions first — they need the good days. PT fills gaps afterwards.
  const order: WorkoutKind[] = ["gym", "amrap", "home"];
  for (const kind of order) {
    const want = goals[kind] ?? 0;
    if (want <= 0) continue;
    const pool = byKind.get(kind) ?? [];
    if (!pool.length) {
      shortfalls.push({ kind, wanted: want, got: 0 });
      continue;
    }
    const free = openDays.filter((d) => !taken.has(d));
    const slots = spread(free, want);
    let placed = 0;
    for (const date of slots) {
      // Pick a template that varies the movement pattern from the day before.
      const prev = items.find((i) => i.date === previousDay(date, days));
      const prevPattern = prev ? patternOf(prev.template) : null;
      const candidates = pool.filter((t) => !usedNames.has(t.name));
      const list = candidates.length ? candidates : pool;
      const pick =
        list.find((t) => patternOf(t) !== prevPattern) ?? list[0];
      if (!pick) break;
      items.push({ date, template: pick, kind });
      usedNames.add(pick.name);
      taken.add(date);
      placed++;
    }
    if (placed < want) shortfalls.push({ kind, wanted: want, got: placed });
  }

  // PT is short — it doubles up with whatever else is on that day.
  const ptWant = goals.pt ?? 0;
  const ptPool = byKind.get("pt") ?? [];
  if (ptWant > 0) {
    if (!ptPool.length) {
      shortfalls.push({ kind: "pt", wanted: ptWant, got: 0 });
    } else {
      const ptDays = spread(openDays, Math.min(ptWant, openDays.length));
      let i = 0;
      for (const date of ptDays) {
        const pick = ptPool[i % ptPool.length];
        items.push({ date, template: pick, kind: "pt" });
        i++;
      }
      if (ptDays.length < ptWant) {
        shortfalls.push({ kind: "pt", wanted: ptWant, got: ptDays.length });
      }
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return { items, shortfalls };
}

function previousDay(date: string, days: string[]): string | null {
  const i = days.indexOf(date);
  return i > 0 ? days[i - 1] : null;
}
