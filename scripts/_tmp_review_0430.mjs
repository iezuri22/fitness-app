import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Try multiple key locations
const CANDIDATES = [
  process.env.LIFT_ADMIN_KEY,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  process.env.HOME + '/.config/lift/admin-key.json',
  '/sessions/trusting-lucid-cray/mnt/Fitness Coach/fitness-app/scripts/.secrets/admin-key.json',
].filter(Boolean);

const UID = 'GqRFJhv2jmQMC3kGAWPTi8ghRyh1';
const TODAY = '2026-04-30';
const TOMORROW = '2026-05-01';

let sa, KEY_PATH;
for (const p of CANDIDATES) {
  try { sa = JSON.parse(readFileSync(p, 'utf8')); KEY_PATH = p; break; } catch (e) {}
}
if (!sa) {
  console.error(`KEY_LOAD_ERROR: tried ${CANDIDATES.join(' ; ')}`);
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
    console.log(`slot=${w.slot} status=${w.status} title=${w.title} focus=${w.focus} estMinutes=${w.estMinutes}`);
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
