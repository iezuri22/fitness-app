import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const KEY_PATH = process.env.HOME + '/.config/lift/admin-key.json';
const UID = 'GqRFJhv2jmQMC3kGAWPTi8ghRyh1';
const TODAY = '2026-04-24';
const TOMORROW = '2026-04-25';

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
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
      console.log(`  [${d.order}] ${d.exerciseName} | ${d.setType} | tgt=${d.targetReps}r@${d.targetWeight}lb act=${d.actualReps??'-'}r@${d.actualWeight??'-'}lb status=${d.status} completedAt=${d.completedAt?.toDate?.()?.toISOString?.()||'-'} notes=${(d.userNotes||d.notes||'').replace(/\n/g,' ')}`);
    }
  }
};

await dump(todayQ, `TODAY ${TODAY}`);
await dump(tomQ, `TOMORROW ${TOMORROW}`);
process.exit(0);
