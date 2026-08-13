import { readFileSync } from 'fs';
const SESSION_PREFIX = '/sessions/hopeful-brave-mccarthy/mnt';
const CANDIDATES = [
  process.env.LIFT_ADMIN_KEY,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  process.env.HOME + '/.config/lift/admin-key.json',
  `${SESSION_PREFIX}/Fitness Coach/fitness-app/scripts/.secrets/admin-key.json`,
  `${SESSION_PREFIX}/Fitness Coach/.secrets/admin-key.json`,
  `${SESSION_PREFIX}/Fitness Coach/admin-key.json`,
  `${SESSION_PREFIX}/uploads/admin-key.json`,
].filter(Boolean);
const errors = [];
let KEY_PATH;
for (const p of CANDIDATES) {
  try { JSON.parse(readFileSync(p, 'utf8')); KEY_PATH = p; break; }
  catch (e) { errors.push(`${p}: ${e.code || e.message}`); }
}
if (KEY_PATH) console.error('Loaded key from: ' + KEY_PATH);
else { for (const e of errors) console.error('  ' + e); process.exit(2); }
