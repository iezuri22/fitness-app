export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function prettyDate(iso: string): string {
  // "2026-04-20" → "Mon, Apr 20"
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * ISO-week string for a given date. Returns "YYYY-Www" like "2026-W17".
 * Uses ISO 8601: weeks start on Monday; week 1 is the week containing Jan 4.
 */
export function isoWeekOf(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Shift to nearest Thursday so that week calculation lands in correct year.
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Returns the Monday→Sunday date-string range for the week containing `d`.
 * Used to scope "this week's completed workouts" queries.
 */
export function weekRange(d: Date = new Date()): { start: string; end: string } {
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const monOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + monOffset);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  return { start: todayStr(mon), end: todayStr(sun) };
}
