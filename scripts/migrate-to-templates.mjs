#!/usr/bin/env node
/**
 * migrate-to-templates.mjs
 *
 * One-time migration: convert the date-locked workouts for 4/23-4/26 into
 * reusable WorkoutTemplates in this week's pool, then delete the source
 * workouts so the new menu-driven Home page picks them up cleanly.
 *
 * USAGE
 *   node migrate-to-templates.mjs               # dry run (shows plan)
 *   node migrate-to-templates.mjs --commit      # actually write
 *
 * Writes:
 *   /users/{uid}/templates/{autoId}   ← one per existing 4/23-4/26 workout
 * Deletes:
 *   /users/{uid}/workouts/{existingId} for those same docs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const { values: args } = parseArgs({
  options: {
    commit: { type: "boolean", default: false },
    "key-path": { type: "string" },
    "week-tag": { type: "string", default: "2026-W17" },
    "start-date": { type: "string", default: "2026-04-23" },
    "end-date": { type: "string", default: "2026-04-26" },
  },
  allowPositionals: false,
});

const KEY_PATH =
  args["key-path"] ||
  process.env.LIFT_ADMIN_KEY ||
  join(homedir(), ".config", "lift", "admin-key.json");
const EMAIL = process.env.LIFT_USER_EMAIL || "iezuri22@gmail.com";
const COMMIT = args.commit;
const WEEK = args["week-tag"];
const START = args["start-date"];
const END = args["end-date"];

function inferCategory(w) {
  // slot-based first (most reliable)
  if (w.slot === "morning-pt") return "PT Only";
  if (w.slot === "strength") return "Full";
  // title/focus fallback
  const hay = `${w.title || ""} ${w.focus || ""}`.toLowerCase();
  if (/\b(pt|rehab|recovery)\b/.test(hay) && !/strength|upper|lower|core|full/.test(hay)) {
    return "PT Only";
  }
  return "Full";
}

async function main() {
  let keyJson;
  try {
    keyJson = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  } catch (e) {
    console.error(`[fatal] Cannot read service account at ${KEY_PATH}`);
    console.error(`        ${e.message}`);
    process.exit(2);
  }

  initializeApp({ credential: cert(keyJson) });
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const auth = getAuth();
  const user = await auth.getUserByEmail(EMAIL);
  const uid = user.uid;
  console.log(`[ok] Resolved ${EMAIL} → uid ${uid}`);

  const workoutsCol = db.collection(`users/${uid}/workouts`);
  const templatesCol = db.collection(`users/${uid}/templates`);

  // Fetch all workouts in the date range.
  const snap = await workoutsCol
    .where("date", ">=", START)
    .where("date", "<=", END)
    .get();

  if (snap.empty) {
    console.log(`[info] No workouts found between ${START} and ${END}.`);
    process.exit(0);
  }

  console.log(
    `[plan] ${snap.size} workout(s) to migrate into templates tagged poolWeek="${WEEK}":\n`
  );

  const ops = [];
  snap.forEach((d) => {
    const w = d.data();
    const category = inferCategory(w);
    // Template plannedSets: drop stale per-execution state so every start
    // from this template is a fresh run.
    const plannedSets = (w.plannedSets || []).map((s) => ({
      ...s,
      completedAt: null,
      actualReps: undefined,
      actualWeight: undefined,
      userNotes: undefined,
    }));
    const template = {
      name: w.title || "Untitled",
      focus: w.focus || "",
      category,
      plannedSets,
      poolWeek: WEEK,
      notes: w.notes || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    ops.push({ workoutId: d.id, date: w.date, slot: w.slot, template });
    console.log(
      `  • ${w.date}${w.slot ? ` (${w.slot})` : ""}  →  "${template.name}"  [${category}]  (${plannedSets.length} sets)`
    );
  });

  if (!COMMIT) {
    console.log(`\n[dry-run] No writes. Re-run with --commit to execute.`);
    process.exit(0);
  }

  console.log(`\n[commit] Writing…`);
  const batch = db.batch();
  for (const op of ops) {
    const tRef = templatesCol.doc();
    batch.set(tRef, op.template);
    batch.delete(workoutsCol.doc(op.workoutId));
  }
  await batch.commit();
  console.log(
    `[ok] Created ${ops.length} templates and deleted ${ops.length} dated workouts.`
  );
}

main().catch((e) => {
  console.error(`[fatal] ${e.stack || e.message || e}`);
  process.exit(1);
});
