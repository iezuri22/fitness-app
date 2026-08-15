#!/usr/bin/env npx tsx
/**
 * fix-template-durations.ts
 *
 * One-off migration: make a routine's name and the duration on its card agree.
 *
 * Names promise a length — "Home · Full Body 30", "Gym · Express Upper 25" —
 * but the card showed whatever the per-set model guessed, and that model runs
 * low: it doesn't know about setup, plate changes or walking between machines,
 * and it treats a 60-second stretch hold as 33 seconds. So "Full Body 30" read
 * as 24 min and "Full Wind Down 10" read as 5.
 *
 * This stamps `estimatedMinutes` on any template whose name claims a duration,
 * which the estimator now honours over its own guess. The starter pack ships
 * with these stamps already, but templates that are ALREADY in Firestore
 * predate that, which is what this fixes.
 *
 * USAGE
 *   npx tsx scripts/fix-template-durations.ts            # dry run — reports only
 *   npx tsx scripts/fix-template-durations.ts --apply    # writes
 *
 * SAFETY
 *   · Dry run by default. Nothing is written without --apply.
 *   · Templates only. Workouts — planned, in progress or finished — are never
 *     touched; a workout's length is a record of what happened.
 *   · Only writes when the name claims a duration AND the card currently
 *     disagrees, so re-running it is a no-op.
 *   · AMRAP and flow templates are REPORTED, NEVER WRITTEN. Their duration is
 *     `capMinutes`, the clock the runner counts down, and past AMRAP scores
 *     are only comparable against a fixed cap — silently retiming a benchmark
 *     would invalidate history. Fix those by hand in the app if you want them
 *     changed.
 *
 * Shares `minutesClaimedByName` and the estimator with the app, so the
 * migration and the running app can't disagree about what a name promises.
 */
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { minutesClaimedByName } from "../src/lib/starterTemplates";
import { estimatePlannedMinutes } from "../src/lib/timeEstimate";
import type { PlannedSet, WorkoutFormat } from "../src/lib/types";

const APPLY = process.argv.includes("--apply");
const KEY_PATH =
  process.env.LIFT_ADMIN_KEY ?? `${process.env.HOME}/.config/lift/admin-key.json`;
const USER_EMAIL = process.env.LIFT_USER_EMAIL ?? "iezuri22@gmail.com";

/** Refuse absurd values — a name like "Gym · Push 500" is not a duration. */
const MIN_PLAUSIBLE = 1;
const MAX_PLAUSIBLE = 300;

async function main() {
  const sa = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();
  // Firestore's default gRPC transport hangs indefinitely on some networks.
  // REST goes over ordinary HTTPS and works anywhere Auth already does.
  db.settings({ preferRest: true });

  const { getAuth } = await import("firebase-admin/auth");
  const user = await getAuth().getUserByEmail(USER_EMAIL);
  const uid = user.uid;

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} for ${USER_EMAIL} (${uid})\n`);

  const snap = await db.collection(`users/${uid}/templates`).get();

  const toFix: { id: string; name: string; from: number; to: number }[] = [];
  const clocked: string[] = [];
  const skipped: string[] = [];
  let alreadyRight = 0;
  let noClaim = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as {
      name?: string;
      format?: WorkoutFormat;
      capMinutes?: number;
      estimatedMinutes?: number;
      plannedSets?: PlannedSet[];
    };
    const name = data.name ?? "";
    const claim = minutesClaimedByName(name);
    if (claim == null) {
      noClaim += 1;
      continue;
    }
    if (claim < MIN_PLAUSIBLE || claim > MAX_PLAUSIBLE) {
      skipped.push(`${name} — "${claim}" isn't a plausible duration`);
      continue;
    }

    const shown = Math.round(
      estimatePlannedMinutes({
        plannedSets: data.plannedSets ?? [],
        format: data.format,
        capMinutes: data.capMinutes,
        estimatedMinutes: data.estimatedMinutes,
      })
    );
    if (shown === claim) {
      alreadyRight += 1;
      continue;
    }

    // Clocked formats are the runner's countdown and, for AMRAPs, the basis of
    // every past score. Report, never rewrite.
    if (data.format === "amrap" || data.format === "flow") {
      clocked.push(
        `${name} — name says ${claim}, ${data.format} cap is ${data.capMinutes ?? "unset"} (left alone)`
      );
      continue;
    }

    toFix.push({ id: doc.id, name, from: shown, to: claim });
  }

  for (const t of toFix) {
    console.log(`  ${t.name.padEnd(34)} ${t.from} min → ${t.to} min`);
  }

  if (clocked.length) {
    console.log(`\nNeeds a decision you have to make (not changed here):`);
    for (const c of clocked) console.log(`  · ${c}`);
    console.log(
      `  Change a cap in the app: Routines → Manage → ⋯ → Name & duration.`
    );
  }
  if (skipped.length) {
    console.log(`\nSkipped:`);
    for (const s of skipped) console.log(`  · ${s}`);
  }

  if (APPLY) {
    for (const t of toFix) {
      await db
        .doc(`users/${uid}/templates/${t.id}`)
        .update({ estimatedMinutes: t.to, updatedAt: Date.now() });
    }
  }

  console.log(
    `\n${toFix.length} template${toFix.length === 1 ? "" : "s"} to fix. ` +
      `${alreadyRight} already agreed, ${noClaim} name no duration, ` +
      `${snap.size} total.`
  );
  if (!APPLY && toFix.length > 0) {
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
