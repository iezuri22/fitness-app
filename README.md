# Lift — Workout Logger

A private PWA for logging workouts. Replaces the Notion workout flow with:

- Sign in with email + password (your data lives in your own Firestore subtree)
- Three workout runners: a tap-through set logger, a scored AMRAP clock, and a
  guided mobility timer — any of them viewable as a plain set list
- Named benchmark AMRAPs you repeat and score over time, plus 5- and 10-minute
  mobility flows whose holds sum exactly to their cap
- Tell it what's sore and it recommends a session that works around it
- Body-part reference pages — what each area does, how to train it, what to avoid
- Per-exercise history with best-set highlight, and a daily supplement checklist
- Exercise library pre-seeded with a shoulder-safe (post-Latarjet) catalog
- Installs to iPhone home screen (PWA), works offline after first load

**Stack:** Vite + React + TypeScript + Tailwind v4 + Firebase (Auth + Firestore) + vite-plugin-pwa. Deployed on Vercel.

---

## 1. Firebase setup (one time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Name it `lift` (or whatever). Google Analytics off is fine.
2. In the left sidebar → **Build → Authentication** → **Get started**. Enable **Email/Password** and save.
3. In the left sidebar → **Build → Firestore Database** → **Create database**. Choose **Production mode**. Pick the region closest to you (e.g. `nam5` for Chicago).
4. Go to **Project settings** (gear icon, top-left). Scroll to **Your apps** → click the `</>` (web) icon to **register a web app**. Name it `lift-web`. **Do not** enable Firebase Hosting. Click Register.
5. Firebase shows you a `firebaseConfig` object. Copy the values.
6. In this folder: `cp .env.example .env.local`, then paste each value into the matching `VITE_FIREBASE_*` slot.
7. Deploy the security rules so users can only see their own data:
   - Install the Firebase CLI: `npm i -g firebase-tools`
   - `firebase login`
   - `firebase use --add` → pick your new project
   - `firebase deploy --only firestore:rules`

## 2. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Sign up with your email. On first login the app seeds ~30 starter exercises (shoulder-safe, with banned lifts pre-flagged).

## 3. Deploy to Vercel

> **Before you share the URL with anyone else, complete step 3b below.**
> Otherwise their logins will fail silently.

This repo is already wired up: the Vercel project is connected to GitHub, so
**every push to `main` deploys automatically**. Nothing else to do.

Setting it up from scratch elsewhere:

1. At [vercel.com/new](https://vercel.com/new), import the GitHub repo.
2. **Framework preset**: Vite (auto-detected).
3. **Environment variables**: paste every `VITE_FIREBASE_*` from your `.env.local`.
4. Click **Deploy**. In ~60 seconds you get a URL like `lift-xyz.vercel.app`.
5. Open it on your iPhone in Safari → Share → **Add to Home Screen**. It launches like an app.

To deploy from the CLI instead of by pushing, `npx vercel --prod`.

### 3b. Authorize your Vercel domain in Firebase (required for multi-user)

Firebase Auth only accepts logins from domains on its allowlist. `localhost` is auto-allowed; your Vercel domain is not.

1. Firebase Console → **Authentication** → **Settings** tab → **Authorized domains**.
2. Click **Add domain** and paste your Vercel domain (e.g. `lift-xyz.vercel.app`).
3. If you add a custom domain later, add that too.

Skip this and anyone (including you) trying to sign in on the live URL gets an opaque `auth/unauthorized-domain` error.

---

## Sharing with friends

The app is multi-user out of the box — each person who signs up gets a private Firestore subtree (`/users/{uid}/...`) and security rules prevent anyone from seeing anyone else's data. You don't need to change the code.

**What to know before sharing the URL:**

- **Open signups:** anyone with the URL can create an account. Fine for a friend group; don't post the URL in a public forum.
- **First-run seed picker:** new users get a prompt to pick either a Generic starter library (~30 common exercises) or a Shoulder-safe library (If's post-Latarjet catalog with banned lifts flagged). They can edit anything afterward.
- **Their data lives in your Firebase project.** If you delete the project, their data is gone with it. Let them know.
- **Free-tier limits:** Firebase Spark plan gives 50K monthly active users, 50K Firestore reads/day, 20K writes/day. You won't touch these with friends-scale usage.
- **Authorized domains:** make sure your Vercel domain is in Firebase → Auth → Settings → Authorized domains (see step 3b).
- **No email verification:** a typo in signup creates an orphaned account. If that matters, enable email verification in Firebase Console → Auth → Templates.

## 4. Firestore data shape

All documents are scoped per user:

```
/users/{uid}
  /exercises/{exerciseId}   — Exercise
  /workouts/{workoutId}     — Workout (with plannedSets[] subdoc array)
```

Security rules (`firestore.rules`) enforce that a user can only read/write their own subtree.

## 5. Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Preview the built `dist/` locally |
| `npm run preview:ui` | **UI preview mode** on :5174 — swaps Firestore for in-memory fixtures so any signed-in screen can be worked on without logging in. Dev only; never bundled. |
| `npm run lint` | ESLint |

## 6. Files worth knowing

- `src/index.css` + `src/components/ui.tsx` — the design system. Read the house
  rules at the top of `ui.tsx` before adding a screen.
- `src/App.tsx` — routes
- `src/pages/Today.tsx` — today's workout card
- `src/pages/Workout.tsx` — execution flow; dispatches to the AMRAP and flow runners
- `src/components/AmrapRunner.tsx` / `FlowRunner.tsx` — scored and guided runners
- `src/pages/Recommend.tsx` + `src/lib/recommend.ts` — the "what's sore" recommender
- `src/pages/Body.tsx` + `src/lib/bodyPartGuide.ts` — body-part reference
- `src/pages/Exercises.tsx` + `ExerciseDetail.tsx` — library + per-exercise history
- `src/lib/starterTemplates.ts` — the workout pack. Exercise names must match the
  catalog or they're silently skipped; benchmark rounds must never change.
- `src/lib/db.ts` — all Firestore reads/writes
- `src/lib/db.preview.ts` — fixture stand-in used by `preview:ui`
- `firestore.rules` — security rules
