import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Whether there's an entry to pop back to inside this app session.
 *
 * React Router stamps a monotonic `idx` into history state on every push, so
 * `idx > 0` means we navigated here from somewhere of ours. A cold launch, a
 * deep link or a fresh PWA start leaves it at 0, where popping would drop the
 * user out of the app — or, in a standalone PWA, onto a blank screen.
 */
export function canGoBack(): boolean {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === "number" && state.idx > 0;
}

/**
 * Back that actually goes back.
 *
 * The app used to thread a destination through the URL (`?from=/plan`) and
 * navigate *forward* to it, which had three problems: only some link sites set
 * it, so the rest fell through to a hard-coded default; the forward navigation
 * grew the history stack instead of unwinding it; and the destination was a
 * path, so it couldn't restore where you were on that page.
 *
 * Popping real history fixes all three. The fallback is passed at call time,
 * not when the hook runs, because a page often can't work out where it came
 * from until after it has loaded its data — and a hook can't sit below an
 * early return. It is only used when there is
 * no history to pop — an opened link, a shared URL, a relaunched PWA — and it
 * replaces rather than pushes, so the dead entry doesn't linger.
 */
export function useBack() {
  const nav = useNavigate();
  return useCallback(
    (fallback = "/") => {
      if (canGoBack()) nav(-1);
      else nav(fallback, { replace: true });
    },
    [nav]
  );
}
