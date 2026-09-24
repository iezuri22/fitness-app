import { useEffect, useState } from "react";
import { subscribe } from "../lib/dbCache";

/**
 * A number that goes up when a background refresh brings back data that
 * differs from what was shown. Add it to a load effect's dependencies and the
 * page re-reads — from memory, so it doesn't flash a skeleton.
 *
 * This is how a screen painted from the phone's cache catches up with a
 * workout logged on another device, or planned by a script. Pass the cache-key
 * prefixes the page reads so it only re-runs for its own data.
 *
 * Don't use it on screens that hold edits in progress (the workout runner,
 * workout detail, review): re-running their load would replace what's being
 * typed.
 */
export function useDataVersion(...prefixes: string[]): number {
  const [version, setVersion] = useState(0);
  const deps = prefixes.join("|");
  useEffect(() => {
    const wanted = deps.split("|").filter(Boolean);
    let queued = false;
    return subscribe((key) => {
      if (wanted.length && !wanted.some((p) => key.startsWith(p))) return;
      // Several keys often refresh together; re-read once.
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        setVersion((v) => v + 1);
      });
    });
  }, [deps]);
  return version;
}
