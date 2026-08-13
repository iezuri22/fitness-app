import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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
});

/**
 * Firebase Storage — used for user-uploaded exercise GIFs/PNGs.
 * Requires Storage to be enabled in the Firebase console and `storage.rules`
 * to be deployed. If the bucket isn't set up, uploads will fail with a clear
 * error that the UI surfaces to the user.
 */
export const storage: FirebaseStorage = getStorage(app);
