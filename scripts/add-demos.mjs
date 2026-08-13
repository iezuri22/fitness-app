#!/usr/bin/env node
/**
 * Bundle exercise demos into the app, using one folder per exercise.
 *
 * Why this exists: the in-app upload writes to Firebase Storage, which isn't
 * provisioned on this project (and would need a billing plan). Every demo the
 * app already ships is a bundled asset instead — faster, works offline, no
 * cloud dependency.
 *
 * How it works — run `npm run publish-demos`:
 *   - First run: creates `demo-inbox/<Exercise Name>/` for every exercise that
 *     still has no demo, then stops so you can fill them in.
 *   - Drop a GIF into whichever folders you like. Filenames don't matter.
 *   - Run it again: each image is bundled under its folder's exercise, the
 *     folder is removed, and the app is rebuilt + deployed.
 *
 * Loose files dropped straight into demo-inbox/ still work too — you'll be
 * asked which exercise each one belongs to.
 */
import {
  readdirSync, renameSync, existsSync, mkdirSync, rmSync,
  readFileSync, writeFileSync, statSync,
} from "fs";
import { join, extname, basename } from "path";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const INBOX = join(ROOT, "demo-inbox");
const GIFS = join(ROOT, "public", "gifs");
const CATALOG_FILE = join(ROOT, "src", "lib", "exerciseGifs.ts");
const MARKER = "  // --- USER-ADDED DEMOS (managed by scripts/add-demos.mjs) ---";
const VALID_EXT = new Set([".gif", ".png", ".jpg", ".jpeg", ".webp"]);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const slugify = (s) => norm(s).replace(/ /g, "-");
/** macOS shows "/" as ":" in folder names, so swap it out when creating them. */
const folderName = (s) => s.replace(/\//g, "-");

if (!existsSync(INBOX)) mkdirSync(INBOX, { recursive: true });

// ---------- Load the exercise library + which ones still need a demo ----------
let catalog = readFileSync(CATALOG_FILE, "utf8");

function parseCatalog(src) {
  const body = src.slice(src.indexOf("const CATALOG"), src.indexOf("function normalize"));
  return [...body.matchAll(/\{\s*slug:\s*"([^"]+)"(?:,\s*ext:\s*"([^"]+)")?(?:,\s*frames:\s*(2))?,\s*matches:\s*\[([^\]]*)\]/g)]
    .map(([, slug, , , m]) => ({ slug, matches: [...m.matchAll(/"([^"]+)"/g)].map((x) => x[1]) }));
}
const cat0 = parseCatalog(catalog);
const hasDemo = (name) => {
  const n = norm(name);
  return cat0.some((e) => e.matches.some((m) => n.includes(norm(m))));
};

const allNames = [];
for (const f of ["notionExercises", "homeExercises", "gymExercises"]) {
  const p = join(ROOT, "src", "lib", `${f}.ts`);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, "utf8");
  for (const m of src.matchAll(/name:\s*'((?:[^'\\]|\\.)*)'/g)) allNames.push(m[1].replace(/\\'/g, "'"));
  for (const m of src.matchAll(/name:\s*"((?:[^"\\]|\\.)*)"/g)) allNames.push(m[1]);
}
const exercises = [...new Set(allNames)];
const needsDemo = exercises.filter((n) => !hasDemo(n)).sort();

// ---------- Scan the inbox ----------
const entries = readdirSync(INBOX).filter((f) => !f.startsWith("."));
const looseFiles = entries.filter(
  (f) => statSync(join(INBOX, f)).isFile() && VALID_EXT.has(extname(f).toLowerCase())
);
const folders = entries.filter((f) => statSync(join(INBOX, f)).isDirectory());

const filled = []; // { folder, file, exercise }
for (const dir of folders) {
  const imgs = readdirSync(join(INBOX, dir))
    .filter((f) => !f.startsWith(".") && VALID_EXT.has(extname(f).toLowerCase()))
    .sort();
  if (!imgs.length) continue;
  const match = exercises.find((e) => norm(e) === norm(dir));
  if (!match) {
    console.log(`!  Folder "${dir}" doesn't match any exercise — skipping.`);
    continue;
  }
  if (imgs.length > 1) console.log(`   "${dir}" has ${imgs.length} images — using ${imgs[0]}.`);
  filled.push({ folder: dir, file: imgs[0], exercise: match });
}

// ---------- Nothing to do yet: lay out the folders and stop ----------
if (!filled.length && !looseFiles.length) {
  // Only lay out folders when explicitly asked (`npm run demo-folders`), so a
  // plain run doesn't resurrect folders you've deliberately deleted.
  if (!process.argv.includes("--folders")) {
    console.log("\nNothing to publish — demo-inbox has no images in it.");
    console.log("To lay out a folder per exercise still missing a demo:  npm run demo-folders\n");
    process.exit(0);
  }
  let made = 0;
  for (const name of needsDemo) {
    const dir = join(INBOX, folderName(name));
    if (!existsSync(dir)) { mkdirSync(dir, { recursive: true }); made++; }
  }
  console.log(`\n📁  demo-inbox is ready — ${needsDemo.length} folders, one per exercise still missing a demo.`);
  if (made) console.log(`    (created ${made} new folder${made === 1 ? "" : "s"})`);
  console.log(`\n    ${INBOX}\n`);
  console.log("    Paste a GIF into whichever folders you want. Filenames don't matter.");
  console.log("    Then run this again and it'll bundle them and deploy.\n");
  process.exit(0);
}

// ---------- Loose files: ask which exercise each belongs to ----------
const assignments = [...filled];
if (looseFiles.length) {
  const rl = createInterface({ input: stdin, output: stdout });
  let closed = false;
  rl.once("close", () => { closed = true; });
  const ask = async (q) => {
    if (closed) return "";
    const onClose = new Promise((res) => rl.once("close", () => res("")));
    try { return await Promise.race([rl.question(q), onClose]); } catch { return ""; }
  };

  for (const file of looseFiles) {
    console.log(`\n"${file}" is loose in demo-inbox — which exercise is it?\n`);
    let pool = needsDemo;
    for (;;) {
      pool.slice(0, 40).forEach((n, i) => console.log(`   ${String(i + 1).padStart(2)}) ${n}`));
      if (pool.length > 40) console.log(`   … ${pool.length - 40} more — type part of a name to filter`);
      const ans = ((await ask(`\n   Number, or type a name, or 's' to skip: `)) || "").trim();
      if (!ans || ans.toLowerCase() === "s") { console.log("   skipped\n"); break; }
      const num = Number(ans);
      if (Number.isInteger(num) && num >= 1 && num <= Math.min(pool.length, 40)) {
        assignments.push({ file, exercise: pool[num - 1] });
        console.log(`   ✓ ${file} → ${pool[num - 1]}\n`);
        break;
      }
      const hits = exercises.filter((n) => norm(n).includes(norm(ans)));
      if (!hits.length) { console.log(`   Nothing matches "${ans}". Try again.\n`); continue; }
      if (hits.length === 1) {
        assignments.push({ file, exercise: hits[0] });
        console.log(`   ✓ ${file} → ${hits[0]}\n`);
        break;
      }
      pool = hits;
      console.log("");
    }
  }
  rl.close();
}

if (!assignments.length) {
  console.log("\nNothing assigned — no changes made.\n");
  process.exit(0);
}

// ---------- Bundle each image and register it ----------
const added = [];
for (const a of assignments) {
  const src = a.folder ? join(INBOX, a.folder, a.file) : join(INBOX, a.file);
  const slug = slugify(a.exercise);
  let ext = extname(a.file).toLowerCase();
  if (ext === ".jpeg") ext = ".jpg";

  // Never clobber an existing asset — suffix until the name is free.
  let dest = `${slug}${ext}`, n = 2;
  while (existsSync(join(GIFS, dest))) dest = `${slug}-${n++}${ext}`;
  renameSync(src, join(GIFS, dest));
  if (a.folder) rmSync(join(INBOX, a.folder), { recursive: true, force: true });

  const extAttr = ext === ".gif" ? "" : ` ext: "${ext.slice(1)}",`;
  const entry = `  { slug: "${basename(dest, ext)}",${extAttr} matches: ["${norm(a.exercise)}"] },`;
  if (!catalog.includes(MARKER)) {
    catalog = catalog.replace("const CATALOG: GifEntry[] = [", `const CATALOG: GifEntry[] = [\n${MARKER}`);
  }
  // Insert at the top so a demo you added always beats a generic fallback.
  catalog = catalog.replace(MARKER, `${MARKER}\n${entry}`);
  added.push({ exercise: a.exercise, dest });
}
writeFileSync(CATALOG_FILE, catalog);

console.log(`\n✅  Bundled ${added.length} demo${added.length === 1 ? "" : "s"}:`);
added.forEach((a) => console.log(`    ${a.exercise}  →  ${a.dest}`));

// ---------- Build + deploy ----------
console.log("\n🔨  Building…\n");
if (spawnSync("npm", ["run", "build"], { stdio: "inherit" }).status !== 0) {
  console.error("\nBuild failed — nothing deployed. The demos are still bundled locally.\n");
  process.exit(1);
}
console.log("\n🚀  Deploying…\n");
if (spawnSync("vercel", ["--prod"], { stdio: "inherit" }).status !== 0) {
  console.error("\nDeploy failed. Run `vercel --prod` yourself to retry.\n");
  process.exit(1);
}
console.log("\n🎉  Live. On your phone: Settings → Refresh app.\n");
