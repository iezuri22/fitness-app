#!/usr/bin/env node
/**
 * list-exercise-names.mjs
 *
 * Dumps every exercise name in the user's /exercises subcollection, one per
 * line. Used to find the exact canonical name for a workout plan.
 *
 *   node list-exercise-names.mjs               # all
 *   node list-exercise-names.mjs squat row     # filter (case-insensitive OR match)
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const KEY_PATH =
  process.env.LIFT_ADMIN_KEY ||
  join(homedir(), ".config", "lift", "admin-key.json");

const keyJson = JSON.parse(readFileSync(KEY_PATH, "utf8"));
initializeApp({ credential: cert(keyJson) });
const db = getFirestore();

const email = process.env.LIFT_USER_EMAIL || "iezuri22@gmail.com";
const uid = (await getAuth().getUserByEmail(email)).uid;

const snap = await db.collection(`users/${uid}/exercises`).get();
const names = snap.docs.map((d) => d.data().name).sort((a, b) => a.localeCompare(b));

// Each arg is a comma-separated group of tokens that ALL must appear (AND
// within a group); any group matching counts as a hit (OR across groups).
// Example: "floor,press" matches names containing both "floor" and "press".
const filterGroups = process.argv.slice(2).map((s) =>
  s.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean)
);
const filtered = filterGroups.length
  ? names.filter((n) => {
      const lower = n.toLowerCase();
      return filterGroups.some((group) => group.every((t) => lower.includes(t)));
    })
  : names;

console.log(filtered.join("\n"));
console.error(`\n[${filtered.length} of ${names.length}]`);
process.exit(0);
