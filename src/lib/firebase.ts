import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  // Don't throw — let the UI show a helpful message instead of a blank screen.
   
  console.warn(
    `[firebase] Missing env vars: ${missing.join(", ")}. Create .env.local from .env.example.`
  );
}

export const firebaseConfigReady = missing.length === 0;

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

/**
 * `ignoreUndefinedProperties: true` is critical here — without it, saving a
 * workout with any optional field unset (e.g. a bodyweight exercise with no
 * `targetWeight`) silently fails the entire write because Firestore rejects
 * the undefined value. With this flag, undefined keys are simply omitted.
 */
export const db: Firestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  // Keep Firestore's data in IndexedDB so an app open can paint from the phone
  // instead of waiting on the network (dbCache asks the device first, then the
  // server). It also means an offline gym still shows your plan. Multi-tab so
  // a second tab or the installed PWA beside Safari don't fight over the lock.
  // If IndexedDB isn't available (some private modes) Firestore falls back to
  // memory on its own.
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Firebase Storage (demo uploads) is imported on first use in db.ts, so it
// isn't part of what every app open has to download.
