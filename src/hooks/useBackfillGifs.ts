import { useEffect } from "react";
import { listExercises, updateExercise } from "../lib/db";
import { findGifForName } from "../lib/exerciseGifs";
import { useAuth } from "./useAuth";

/**
 * One-shot migration: for each of the user's existing Firestore exercises,
 * if it has no gifUrl but its name matches a bundled /gifs/ slug, set gifUrl.
 *
 * Idempotent — safe to run on every app load; it only touches docs that
 * would actually change. Uses a sessionStorage flag so it runs at most
 * once per tab session, which is a reasonable compromise between "never
 * re-runs" and "blocks login" (we couldn't run it in a first-login-only
 * flow because new seed exercises already come with gifUrl prebaked).
 */
export function useBackfillGifs() {
  const { user, configReady } = useAuth();

  useEffect(() => {
    if (!user || !configReady) return;
    const flag = `lift.gifs-backfilled.${user.uid}`;
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");

    (async () => {
      try {
        const exercises = await listExercises(user.uid);
        const updates = exercises
          .filter((e) => !e.gifUrl)
          .map((e) => ({ id: e.id, gifUrl: findGifForName(e.name) }))
          .filter((u): u is { id: string; gifUrl: string } => !!u.gifUrl);

        if (updates.length === 0) return;
        await Promise.all(
          updates.map((u) => updateExercise(user.uid, u.id, { gifUrl: u.gifUrl }))
        );
        console.log(`[backfill] Attached GIFs to ${updates.length} exercises.`);
      } catch (e) {
        console.warn("[backfill] Failed to backfill GIFs:", e);
      }
    })();
  }, [user, configReady]);
}
