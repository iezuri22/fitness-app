import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const SESSION_PREFIX = '/sessions/zealous-laughing-noether/mnt';
const CANDIDATES = [
  process.env.LIFT_ADMIN_KEY,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  process.env.HOME + '/.config/lift/admin-key.json',
  `${SESSION_PREFIX}/Fitness Coach/fitness-app/scripts/.secrets/admin-key.json`,
  `${SESSION_PREFIX}/Fitness Coach/.secrets/admin-key.json`,
  `${SESSION_PREFIX}/Fitness Coach/admin-key.json`,
].filter(Boolean);

const errors = [];
let sa, KEY_PATH;
for (const p of CANDIDATES) {
  try { sa = JSON.parse(readFileSync(p, 'utf8')); KEY_PATH = p; break; }
  catch (e) { errors.push(`${p}: ${e.code || e.message}`); }
}
if (!sa) {
  console.error('KEY_LOAD_ERROR — tried:');
  for (const e of errors) console.error('  ' + e);
  process.exit(2);
}
console.error('Loaded key from: ' + KEY_PATH);
