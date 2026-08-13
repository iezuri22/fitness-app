#!/usr/bin/env node
/**
 * push-weekly-workouts.mjs
 *
 * Pushes a week of planned workouts directly into Firestore using Firebase
 * Admin SDK. Used by the `weekly-workout-planner` scheduled task to avoid
 * any manual copy/paste step.
 *
 * USAGE
 *   node push-weekly-workouts.mjs < plan.json
 *   node push-weekly-workouts.mjs --dry-run < plan.json
 *   echo '{"workouts":[...]}' | node push-weekly-workouts.mjs
 *
 * INPUT (JSON on stdin):
 *   {
 *     "userEmail": "iezuri22@gmail.com",   // optional — defaults to env
 *     "workouts": [
 *       {
 *         "date": "2026-04-21",             // YYYY-MM-DD
 *         "slot": "morning-pt",             // optional — "morning-pt" | "strength" | null
 *                                           //   Lets two workouts coexist on the same date.
 *                                           //   Upsert key is (date, slot). Omit for legacy
 *                                           //   1-per-day behavior.
 *         "title": "4/21 — Upper Body + Shoulder Rehab",
 *         "focus": "Upper Body",
 *         "notes": "",
 *         "sets": [
 *           {
 *             "exerciseName": "Sitting Shoulder Pulleys",
 *             "order": 1,
 *             "targetReps": 15,
 *             "targetWeight": null,         // null | number
 *             "setType": "PT/Rehab",        // Working | Warm-up | PT/Rehab | Stretch | Drop
 *             "restSeconds": 30,
 *             "notes": ""
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * BEHAVIOR
 *   - Looks up user by email (needs Authentication enabled, which it is).
 *   - For each exerciseName in each set, resolves the exerciseId from the
 *     user's /exercises subcollection via normalized-name match. If an
 *     exercise isn't found, the script FAILS LOUD (exits non-zero) — better
 *     to notice than silently create broken workouts.
 *   - Upserts by date: if a workout already exists for a given date, it is
 *     OVERWRITTEN (merged into the existing doc). This makes re-runs safe.
 *   - Creates one workout doc per day with status "planned".
 *
 * SECURITY
 *   Reads the Admin SDK service account from ~/.config/lift/admin-key.json.
 *   That file grants root access to the Firestore project — never commit it.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    "key-path": { type: "string" },
  },
  allowPositionals: false,
});

const KEY_PATH =
  args["key-path"] ||
  process.env.LIFT_ADMIN_KEY ||
  join(homedir(), ".config", "lift", "admin-key.json");

const DRY_RUN = args["dry-run"];

// ---- Normalize exercise names (must match src/lib/db.ts) ----
function normalizeName(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---- Read stdin as JSON ----
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Invalid JSON on stdin: ${e.message}`));
      }
    });
    process.stdin.on("error", reject);
  });
}

// ---- Resolve user UID from email via Admin SDK ----
async function resolveUid(email) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  return user.uid;
}

// ---- Main ----
async function main() {
  // Load service account
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
  // Firestore rejects undefined values by default. Our resolved sets intentionally
  // use undefined for optional fields (targetWeight, restSeconds, notes) so they're
  // just omitted from the doc — enable that behavior.
  db.settings({ ignoreUndefinedProperties: true });

  // Read plan
  const plan = await readStdin();
  if (!plan.workouts || !Array.isArray(plan.workouts)) {
    console.error("[fatal] Input JSON must contain a `workouts` array.");
    process.exit(2);
  }

  const email = plan.userEmail || process.env.LIFT_USER_EMAIL || "iezuri22@gmail.com";
  const uid = await resolveUid(email);
  console.log(`[ok] Resolved ${email} → uid ${uid}`);

  // Load user's exercise catalog for name→id resolution
  const exSnap = await db.collection(`users/${uid}/exercises`).get();
  const byName = new Map();
  exSnap.forEach((d) => {
    const data = d.data();
    byName.set(normalizeName(data.name), { id: d.id, name: data.name });
  });
  console.log(`[ok] Loaded ${byName.size} exercises from /users/${uid}/exercises`);

  // Resolve & validate every set in every workout — fail fast if anything's missing
  const resolved = [];
  const missing = new Set();
  for (const w of plan.workouts) {
    const sets = [];
    for (const s of w.sets) {
      const match = byName.get(normalizeName(s.exerciseName));
      if (!match) {
        missing.add(s.exerciseName);
        continue;
      }
      sets.push({
        id: randomUUID(),
        exerciseId: match.id,
        exerciseName: match.name, // use catalog-canonical casing
        order: s.order ?? 0,
        targetReps: s.targetReps ?? 10,
        targetWeight: s.targetWeight ?? undefined,
        setType: s.setType ?? "Working",
        restSeconds: s.restSeconds ?? undefined,
        notes: s.notes ?? undefined,
        completedAt: null,
      });
    }
    resolved.push({
      date: w.date,
      slot: w.slot ?? undefined,
      title: w.title,
      focus: w.focus,
      status: "planned",
      notes: w.notes ?? undefined,
      plannedSets: sets.sort((a, b) => a.order - b.order),
    });
  }

  if (missing.size) {
    console.error(`[fatal] ${missing.size} exercise name(s) not in the library:`);
    [...missing].forEach((n) => console.error(`        - ${n}`));
    console.error("        Fix the names in the plan JSON or create them in the app first.");
    process.exit(3);
  }

  // Upsert by date: find existing workout for the same date and merge into it,
  // otherwise create a new doc. This makes re-runs safe (no duplicate workouts).
  console.log(DRY_RUN ? "\n[dry-run] Would write:" : "\n[writing]");

  for (const w of resolved) {
    // Upsert key: (date, slot). If slot is omitted, match ONLY legacy docs that
    // also have no slot — so morning-pt and strength won't collide with each
    // other or with older one-per-day entries.
    let query = db
      .collection(`users/${uid}/workouts`)
      .where("date", "==", w.date);
    const slotSnap = await query.get();
    const match = slotSnap.docs.find((d) => {
      const existing = d.data().slot ?? null;
      const incoming = w.slot ?? null;
      return existing === incoming;
    });
    const existingSnap = match
      ? { empty: false, docs: [match] }
      : { empty: true, docs: [] };

    const payload = {
      ...w,
      updatedAt: Date.now(),
    };

    if (existingSnap.empty) {
      payload.createdAt = Date.now();
      if (DRY_RUN) {
        console.log(`  [create] ${w.date} — ${w.title} (${w.plannedSets.length} sets)`);
      } else {
        const ref = await db.collection(`users/${uid}/workouts`).add(payload);
        console.log(`  [created] ${w.date} — ${ref.id}`);
      }
    } else {
      const docId = existingSnap.docs[0].id;
      if (DRY_RUN) {
        console.log(
          `  [overwrite] ${w.date} — ${w.title} (${w.plannedSets.length} sets) → ${docId}`
        );
      } else {
        await db.collection(`users/${uid}/workouts`).doc(docId).set(payload, { merge: true });
        console.log(`  [overwrote] ${w.date} — ${docId}`);
      }
    }
  }

  console.log(
    DRY_RUN
      ? `\n[dry-run] ${resolved.length} workouts would be written.`
      : `\n[done] Pushed ${resolved.length} workouts to /users/${uid}/workouts/`
  );
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
