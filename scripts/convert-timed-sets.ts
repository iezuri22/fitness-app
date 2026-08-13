#!/usr/bin/env npx tsx
/**
 * convert-timed-sets.ts
 *
 * One-off migration: give cardio-machine sets a duration so they log as time
 * instead of reps.
 *
 * Treadmill / rower / stair climber sets predate the timed-set format, so they
 * still carry `targetReps` — historically the app encoded minutes there for
 * cardio (30 "reps" = 30 minutes). This finds those sets and gives them a real
 * `workSeconds`, which is what the set row keys off to show a Time field.
 *
 * USAGE
 *   npx tsx scripts/convert-timed-sets.ts              # dry run — reports only
 *   npx tsx scripts/convert-timed-sets.ts --apply      # writes
 *
 * SAFETY
 *   · Dry run by default. Nothing is written without --apply.
 *   · Only touches templates and *planned* workouts. Completed, in-progress and
 *     skipped workouts are historical records and are left alone — rewriting
 *     what you already did would corrupt your own history.
 *   · Only touches sets that have no `workSeconds` yet, so re-running it is a
 *     no-op rather than a second conversion.
 *   · `targetReps` is left in place. It's unused for a timed set and removing
 *     it buys nothing but risk.
 *
 * Imports the classifier from the app rather than copying the phrase list, so
 * the migration and the running app can never disagree about what counts as a
 * cardio machine.
 */
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isTimeBasedExercise } from "../src/lib/duration";

const APPLY = process.argv.includes("--apply");
const KEY_PATH =
  process.env.LIFT_ADMIN_KEY ?? `${process.env.HOME}/.config/lift/admin-key.json`;
const USER_EMAIL = process.env.LIFT_USER_EMAIL ?? "iezuri22@gmail.com";

/** Fallback when a set gives us nothing usable to read a duration from. */
const DEFAULT_MINUTES = 20;
/** Anything outside this is almost certainly reps, not minutes. */
const MIN_PLAUSIBLE = 3;
const MAX_PLAUSIBLE = 120;

/** Today, so stale plans can be skipped. */
const TODAY = new Date().toISOString().slice(0, 10);

interface SetLike {
  exerciseName?: string;
  targetReps?: number;
  estimatedMinutes?: number;
  workSeconds?: number;
}

/**
 * Minutes this set represents. `estimatedMinutes` is authoritative; otherwise
 * fall back to the legacy convention of storing minutes in `targetReps`, but
 * only when that number is plausible as a duration.
 */
function minutesFor(s: SetLike): number {
  if (typeof s.estimatedMinutes === "number" && s.estimatedMinutes > 0) {
    return s.estimatedMinutes;
  }
  const reps = s.targetReps;
  if (typeof reps === "number" && reps >= MIN_PLAUSIBLE && reps <= MAX_PLAUSIBLE) {
    return reps;
  }
  return DEFAULT_MINUTES;
}

function convertSets(sets: SetLike[]): { sets: SetLike[]; changed: string[] } {
  const changed: string[] = [];
  const next = sets.map((s) => {
    const name = s.exerciseName ?? "";
    if (!isTimeBasedExercise(name)) return s;
    if (s.workSeconds != null) return s; // already converted
    const mins = minutesFor(s);
    changed.push(`${name} → ${mins} min`);
    return { ...s, workSeconds: Math.round(mins * 60), estimatedMinutes: mins };
  });
  return { sets: next, changed };
}

async function main() {
  const sa = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();
  // Firestore's default gRPC transport hangs indefinitely on some networks
  // (it silently fails to establish the channel rather than erroring). REST
  // goes over ordinary HTTPS and works anywhere Auth already does.
  db.settings({ preferRest: true });

  const { getAuth } = await import("firebase-admin/auth");
  const user = await getAuth().getUserByEmail(USER_EMAIL);
  const uid = user.uid;

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} for ${USER_EMAIL} (${uid})\n`);

  let touchedDocs = 0;
  let touchedSets = 0;

  for (const coll of ["templates", "workouts"] as const) {
    const snap = await db.collection(`users/${uid}/${coll}`).get();
    for (const doc of snap.docs) {
      const data = doc.data();

      // Never rewrite something that already happened.
      if (coll === "workouts" && data.status !== "planned") continue;
      // Nor a plan from months ago that was never run — those are abandoned,
      // and rewriting them just churns documents nobody will open.
      if (coll === "workouts" && typeof data.date === "string" && data.date < TODAY) {
        continue;
      }

      const sets: SetLike[] = data.plannedSets ?? [];
      if (!sets.length) continue;

      const { sets: nextSets, changed } = convertSets(sets);
      if (!changed.length) continue;

      touchedDocs += 1;
      touchedSets += changed.length;
      const label = coll === "templates" ? data.name : `${data.date} ${data.title}`;
      console.log(`${coll}/${doc.id}  ${label}`);
      for (const c of changed) console.log(`    ${c}`);

      if (APPLY) {
        await doc.ref.update({ plannedSets: nextSets, updatedAt: Date.now() });
      }
    }
  }

  console.log(
    `\n${touchedSets} set${touchedSets === 1 ? "" : "s"} across ${touchedDocs} ` +
      `document${touchedDocs === 1 ? "" : "s"}.`
  );
  if (!APPLY && touchedSets > 0) {
    console.log("Nothing written. Re-run with --apply to make these changes.");
  }
  if (APPLY) console.log("Written.");
}

main()
  .then(() => {
    // firebase-admin keeps its gRPC channel open, so the process never exits
    // on its own. Without this the script looks like it hung after finishing.
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
