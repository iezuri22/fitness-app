import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const CANDIDATES = [
  process.env.LIFT_ADMIN_KEY,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  process.env.HOME + '/.config/lift/admin-key.json',
  '/sessions/admiring-cool-cerf/mnt/Fitness Coach/fitness-app/scripts/.secrets/admin-key.json',
  '/sessions/admiring-cool-cerf/mnt/Fitness Coach/.secrets/admin-key.json',
  '/sessions/admiring-cool-cerf/mnt/Fitness Coach/admin-key.json',
].filter(Boolean);

const UID = 'GqRFJhv2jmQMC3kGAWPTi8ghRyh1';
const TODAY = '2026-05-01';
const TOMORROW = '2026-05-02';

let sa, KEY_PATH;
const errors = [];
for (const p of CANDIDATES) {
  try { sa = JSON.parse(readFileSync(p, 'utf8')); KEY_PATH = p; break; } catch (e) { errors.push(`${p}: ${e.code || e.message}`); }
}
if (!sa) {
  console.error(`KEY_LOAD_ERROR — tried:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(2);
}
console.error(`Loaded key from: ${KEY_PATH}`);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const todayQ = await db.collection(`users/${UID}/workouts`).where('date', '==', TODAY).get();
const tomQ = await db.collection(`users/${UID}/workouts`).where('date', '==', TOMORROW).get();

const dump = async (snap, label) => {
  console.log(`\n=== ${label} (${snap.size} workouts) ===`);
  for (const doc of snap.docs) {
    const w = doc.data();
    console.log(`\n--- DOCID:${doc.id} ---`);
    console.log(JSON.stringify({ slot: w.slot, status: w.status, title: w.title, focus: w.focus, estMinutes: w.estMinutes, date: w.date }));
    const setsSnap = await db.collection(`users/${UID}/workouts/${doc.id}/sets`).orderBy('order').get();
    console.log(`  ${setsSnap.size} sets:`);
    for (const s of setsSnap.docs) {
      const d = s.data();
      console.log(`  [${d.order}] ${d.exerciseName} | ${d.setType} | tgt=${d.targetReps}r@${d.targetWeight}lb act=${d.actualReps??'-'}r@${d.actualWeight??'-'}lb status=${d.status} notes=${(d.userNotes||d.notes||'').replace(/\n/g,' ')}`);
    }
  }
};

await dump(todayQ, `TODAY ${TODAY}`);
await dump(tomQ, `TOMORROW ${TOMORROW}`);
process.exit(0);
