#!/usr/bin/env npx tsx
/**
 * check-durations.ts
 *
 * Guards one invariant: if a starter template's NAME carries a number, the
 * duration the app shows for it must BE that number.
 *
 * This drifted silently once already — "Home · Full Body 30" was showing
 * 24 min, "PM · Full Wind Down 10" was showing 5 — because the name was
 * written by hand and the duration came from a model that undercounts both
 * strength work and static holds. Nothing failed; the card just quietly lied.
 *
 * Fix a failure by setting `minutes:` on the seed template (see SeedTemplate
 * in starterTemplates.ts), or by renaming it. Not by nudging the estimator —
 * that moves every other template too.
 *
 * USAGE
 *   npx tsx scripts/check-durations.ts     # exits 1 on any mismatch
 */
import {
  STARTER_TEMPLATES,
  minutesClaimedByName,
  resolveStarterTemplates,
} from "../src/lib/starterTemplates";
import { estimatePlannedMinutes } from "../src/lib/timeEstimate";

// Resolve against a catalog containing exactly what the seeds reference, so a
// missing exercise can't quietly shorten a template and mask a real mismatch.
const names = new Set<string>();
for (const t of STARTER_TEMPLATES) for (const s of t.sets.flat()) names.add(s.name);
const catalog = [...names].map((n, i) => ({ id: `ex${i}`, name: n }));

const problems: string[] = [];
let checked = 0;

for (const t of resolveStarterTemplates(catalog)) {
  if (t.missing.length) {
    problems.push(`${t.name}: unresolved exercise(s) — ${t.missing.join(", ")}`);
  }
  const claim = minutesClaimedByName(t.name);
  if (claim == null) continue;
  checked += 1;
  const shown = Math.round(estimatePlannedMinutes(t));
  if (shown !== claim) {
    problems.push(`${t.name}: name says ${claim} min, card shows ${shown} min`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    `\nSet \`minutes:\` on the seed template to state the duration outright, ` +
      `or rename it.\n`
  );
  process.exit(1);
}

console.log(`✓ ${checked} templates name a duration and all of them match.`);
