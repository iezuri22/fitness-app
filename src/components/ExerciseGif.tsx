import { useState } from "react";
import { findGifForName, secondFrameUrl } from "../lib/exerciseGifs";

/**
 * Renders an exercise demo GIF. Uses (in priority order):
 *   1. An explicit `gifUrl` on the Exercise doc
 *   2. A bundled /gifs/<slug>.gif resolved from the exercise name
 *   3. A monochrome placeholder with the exercise initial
 *
 * Sizes:
 *   - "hero"   — full-width square, for ExerciseDetail top slot
 *   - "banner" — full-width 16:9, for each exercise block during a workout
 *   - "card"   — chunky 96px tile, for lists like the exercise library
 *   - "thumb"  — 64px inline tile, for compact rows / picker chips
 *   - "mini"   — 40px chip, for dense rows (superset members, collages)
 */
export default function ExerciseGif({
  name,
  gifUrl,
  size = "hero",
}: {
  name: string;
  gifUrl?: string;
  size?: "hero" | "banner" | "card" | "thumb" | "mini";
}) {
  const resolved = gifUrl || findGifForName(name);
  const [errored, setErrored] = useState(false);

  const dims =
    size === "hero"
      ? "w-full aspect-square max-h-[360px]"
      : size === "banner"
        ? "w-full aspect-[16/10] max-h-[260px]"
        : size === "card"
          ? "size-24 shrink-0"
          : size === "mini"
            ? "size-10 shrink-0 !rounded-lg"
            : "size-16 shrink-0";

  const frame =
    "relative overflow-hidden rounded-[10px] bg-[color:var(--color-surface-2)]";

  // No GIF available — show a monochrome initial placeholder
  if (!resolved || errored) {
    const initial = name.trim().charAt(0).toUpperCase() || "?";
    const letterSize =
      size === "hero" || size === "banner"
        ? "text-6xl font-semibold tracking-tight text-white/20"
        : size === "card"
          ? "text-3xl font-semibold text-white/25"
          : size === "mini"
            ? "text-sm font-semibold text-white/25"
            : "text-xl font-semibold text-white/25";
    return (
      <div className={`${frame} ${dims} grid place-items-center`}>
        <div className={letterSize}>{initial}</div>
      </div>
    );
  }

  // Two-frame photo demos (gym machines/barbells) animate by cross-fading the
  // start and end positions — same read as the bundled GIFs, no encoder needed.
  const frame2 = secondFrameUrl(resolved);

  // Small tiles crop to fill so the lifter isn't a speck between letterbox
  // bars; the large views keep the whole frame so nothing gets cut off.
  const big = size === "hero" || size === "banner";
  const fit = big ? "object-contain" : "object-cover";
  const imgCls = `absolute inset-0 w-full h-full ${fit} bg-black`;

  return (
    <div className={`${frame} ${dims}`}>
      <img
        src={resolved}
        alt={`${name} demo`}
        loading="lazy"
        onError={() => setErrored(true)}
        className={imgCls}
      />
      {frame2 && (
        <img
          src={frame2}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={`${imgCls} animate-frame-swap`}
        />
      )}
    </div>
  );
}
