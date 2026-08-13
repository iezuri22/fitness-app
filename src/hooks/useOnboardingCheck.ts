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
 */
export function useOnboardingCheck(): {
  needsOnboarding: boolean | null;
  error: string | null;
} {
  const { user, configReady } = useAuth();
  const [needsOnboarding, setNeeds] = useState<boolean | null>(null);
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
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, `users/${user.uid}/exercises`), limit(1))
        );
        if (alive) {
          setNeeds(snap.empty);
          setError(null);
        }
      } catch (e: unknown) {
        console.error("[useOnboardingCheck] Firestore read failed:", e);
        if (alive) {
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
