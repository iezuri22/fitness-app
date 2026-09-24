import { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./useAuth";

/**
 * Checks whether the signed-in user needs onboarding (no exercises yet).
 * Returns:
 *   - needsOnboarding === null → still checking
 *   - needsOnboarding === true → redirect to /welcome
 *   - needsOnboarding === false → normal app
 *
 * The answer is remembered per user. This check sits in front of every screen,
 * and it used to cost a network round trip on every app open before anything
 * could draw — to confirm, every time, something that had been true since the
 * first day. Now a known user renders at once and the check runs behind it;
 * if the library has genuinely been emptied, it still redirects.
 */
const flagKey = (uid: string) => `lift.onboarded.${uid}`;

function remembered(uid: string | undefined): boolean {
  if (!uid) return false;
  try {
    return localStorage.getItem(flagKey(uid)) === "1";
  } catch {
    return false;
  }
}

function remember(uid: string, onboarded: boolean) {
  try {
    if (onboarded) localStorage.setItem(flagKey(uid), "1");
    else localStorage.removeItem(flagKey(uid));
  } catch {
    // Private mode or storage full: the check just blocks next time too.
  }
}

export function useOnboardingCheck(): {
  needsOnboarding: boolean | null;
  error: string | null;
} {
  const { user, configReady } = useAuth();
  const [needsOnboarding, setNeeds] = useState<boolean | null>(() =>
    import.meta.env.VITE_UI_PREVIEW === "1" || remembered(user?.uid) ? false : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // UI preview mode (npm run preview:ui) always has a seeded library.
    if (import.meta.env.VITE_UI_PREVIEW === "1") {
      setNeeds(false);
      setError(null);
      return;
    }
    if (!user || !configReady) {
      setNeeds(null);
      setError(null);
      return;
    }
    const known = remembered(user.uid);
    setNeeds(known ? false : null);
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, `users/${user.uid}/exercises`), limit(1))
        );
        remember(user.uid, !snap.empty);
        if (alive) {
          setNeeds(snap.empty);
          setError(null);
        }
      } catch (e: unknown) {
        console.error("[useOnboardingCheck] Firestore read failed:", e);
        if (alive && !known) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          setNeeds(false); // unblock routing; Today will surface a real error
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, configReady]);

  return { needsOnboarding, error };
}
