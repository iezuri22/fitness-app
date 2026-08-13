/**
 * Weekly goals by workout kind.
 *
 * The old model counted two hard-coded buckets ("PT Only" / "Full"), which
 * couldn't express "3 AMRAPs and 2 gym sessions this week". Workouts are now
 * classified into four kinds and each gets its own editable target.
 *
 * Kind is derived rather than stored, so it works for workouts already in
 * Firestore and for anything generated on the fly: an AMRAP declares itself via
 * `format`, and the rest fall out of the template naming convention
 * ("Gym · …", "AM/PM/PT · …") with the focus text as a fallback.
 */
import type { Workout } from "./types";

export type WorkoutKind = "amrap" | "gym" | "home" | "pt" | "class";

export const KINDS: { key: WorkoutKind; label: string; hint: string; tint: string }[] = [
  { key: "gym", label: "Gym", hint: "Full gym sessions", tint: "var(--color-accent)" },
  { key: "amrap", label: "AMRAP", hint: "Cindy-style conditioning", tint: "var(--color-warn)" },
  { key: "home", label: "Home", hint: "Dumbbell / band days", tint: "var(--color-success)" },
  { key: "pt", label: "PT & Stretch", hint: "Rehab and mobility", tint: "var(--color-info)" },
  { key: "class", label: "Classes", hint: "HIIT, spin, yoga…", tint: "var(--color-danger)" },
];

export type WeeklyGoals = Record<WorkoutKind, number>;

/** Sensible starting point: 2 gym, 2 AMRAP, 1 home, PT most days. */
export const DEFAULT_GOALS: WeeklyGoals = { gym: 2, amrap: 2, home: 1, pt: 5, class: 0 };

export function kindOf(w: Pick<Workout, "title" | "focus" | "category" | "format">): WorkoutKind {
  if (w.format === "amrap") return "amrap";
  const hay = `${w.title ?? ""} ${w.focus ?? ""}`.toLowerCase();
  if (hay.includes("class")) return "class";
  if (hay.includes("amrap") || hay.includes("cindy")) return "amrap";
  if (w.category === "PT Only") return "pt";
  if (hay.startsWith("gym") || hay.includes("· gym") || hay.includes("gym ·")) return "gym";
  if (hay.startsWith("home") || hay.includes("· home") || hay.includes("home ·")) return "home";
  // Anything else that isn't PT is a strength session; treat it as a home day
  // since the gym ones are all explicitly named.
  return "home";
}

/** Completed-per-kind for a set of workouts (usually one week's worth). */
export function countByKind(workouts: Workout[]): WeeklyGoals {
  const counts: WeeklyGoals = { amrap: 0, gym: 0, home: 0, pt: 0, class: 0 };
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    counts[kindOf(w)]++;
  }
  return counts;
}

/** Planned-or-completed per kind — what the week is shaping up to be. */
export function plannedByKind(workouts: Workout[]): WeeklyGoals {
  const counts: WeeklyGoals = { amrap: 0, gym: 0, home: 0, pt: 0, class: 0 };
  for (const w of workouts) {
    if (w.status === "skipped") continue;
    counts[kindOf(w)]++;
  }
  return counts;
}

export function normalizeGoals(raw: unknown): WeeklyGoals {
  const g = (raw ?? {}) as Partial<WeeklyGoals>;
  const clamp = (n: unknown, d: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(14, Math.round(n))) : d;
  return {
    amrap: clamp(g.amrap, DEFAULT_GOALS.amrap),
    gym: clamp(g.gym, DEFAULT_GOALS.gym),
    home: clamp(g.home, DEFAULT_GOALS.home),
    pt: clamp(g.pt, DEFAULT_GOALS.pt),
    class: clamp(g.class, DEFAULT_GOALS.class),
  };
}
