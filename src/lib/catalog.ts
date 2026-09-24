/**
 * The importable exercise catalog, and the import itself.
 *
 * Kept out of db.ts on purpose: the three catalog files are ~70 KB of source,
 * and db.ts is loaded by every screen at app start. Only the Exercises and
 * Routines screens import this, so it downloads with them instead.
 *
 * Writes go through db.ts (listExercises / createExercise), so UI preview mode
 * — which swaps db.ts for fixtures — works here too.
 */
import { createExercise, listExercises } from "./db";
import type { Exercise } from "./types";
import { NOTION_EXERCISES } from "./notionExercises";
import { HOME_EXERCISES } from "./homeExercises";
import { GYM_EXERCISES } from "./gymExercises";
import { findGifForName } from "./exerciseGifs";

/**
 * Combined catalog: Notion export (92) + curated home-workout hypertrophy set
 * (200+) + commercial-gym set (barbell/machine/cable/cardio). Home set is
 * filtered for Latarjet constraints (no behind-neck, no deep flys, etc.).
 */
const CATALOG: typeof NOTION_EXERCISES = dedupeByName([
  ...NOTION_EXERCISES,
  ...HOME_EXERCISES,
  ...GYM_EXERCISES,
]);

function dedupeByName<T extends { name: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of list) {
    const k = normalizeExerciseName(e.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** How many catalog entries aren't yet in the user's library. */
export function countMissingCatalog(existing: Exercise[]): number {
  const have = new Set(existing.map((e) => normalizeExerciseName(e.name)));
  return CATALOG.filter((c) => !have.has(normalizeExerciseName(c.name))).length;
}

/**
 * One-shot import of the full catalog (Notion + curated home hypertrophy).
 * De-dupes by normalized name against whatever's already in the user's library
 * and only creates the missing ones. Safe to re-run — won't duplicate.
 * Returns the count of exercises actually created.
 */
export async function importMissingNotionExercises(uid: string): Promise<number> {
  // De-dupe against the server's library, not the phone's copy of it.
  const existing = await listExercises(uid, { fresh: true });
  const existingKeys = new Set(existing.map((e) => normalizeExerciseName(e.name)));
  let created = 0;
  for (const seed of CATALOG) {
    if (existingKeys.has(normalizeExerciseName(seed.name))) continue;
    // Prebake gifUrl so imports show demos immediately (same as first-run seed).
    const gifUrl = seed.gifUrl ?? findGifForName(seed.name);
    await createExercise(uid, gifUrl ? { ...seed, gifUrl } : seed);
    created++;
  }
  return created;
}

function normalizeExerciseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

