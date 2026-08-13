import { useEffect, useRef, useState } from "react";

interface Props {
  seconds: number;
  onDone?: () => void;
  onCancel: () => void;
}

/**
 * Fitbod-style rest timer: bottom sheet that overlays the workout screen
 * with a large circular countdown ring. Backdrop fades in; content slides up.
 *
 * Numbers use tabular-nums so the digits don't reflow as the timer ticks.
 */
export default function RestTimer({ seconds, onDone, onCancel }: Props) {
  const [total, setTotal] = useState(seconds);
  const [remaining, setRemaining] = useState(seconds);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const r = Math.max(0, total - elapsed);
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        beep();
        onDone?.();
      }
    }, 100);
    return () => clearInterval(id);
  }, [total, onDone]);

  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);

  // Ring geometry
  const SIZE = 200;
  const STROKE = 10;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = total > 0 ? remaining / total : 0;
  const dashoffset = CIRC * (1 - progress);

  function addTime(n: number) {
    setTotal((t) => t + n);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <button
        aria-label="Dismiss rest timer"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade"
      />

      {/* Sheet */}
      <div
        className="animate-slide-up relative w-full max-w-xl rounded-t-[16px] bg-[color:var(--color-surface)] px-6 pb-8 pt-2"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[color:var(--color-muted-2)]" />

        <div className="mb-6 flex items-center justify-between">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Rest</div>
          <button
            onClick={onCancel}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Skip
          </button>
        </div>

        {/* Circular countdown */}
        <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            className="-rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={STROKE}
              fill="none"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="var(--color-accent)"
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashoffset}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-[44px] font-semibold tnum tracking-[-0.02em] leading-none">
                {m}:{String(s).padStart(2, "0")}
              </div>
              <div className="mt-1.5 text-[13px] text-[color:var(--color-muted)]">
                remaining
              </div>
            </div>
          </div>
        </div>

        {/* Adjust */}
        <div className="mt-7 flex items-center justify-center gap-3">
          <AdjustButton onClick={() => addTime(-15)}>−15s</AdjustButton>
          <AdjustButton onClick={() => addTime(15)}>+15s</AdjustButton>
          <AdjustButton onClick={() => addTime(30)}>+30s</AdjustButton>
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes _rt_fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes _rt_slide { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-fade { animation: _rt_fade 200ms ease-out forwards; }
        .animate-slide-up { animation: _rt_slide 280ms cubic-bezier(0.32, 0.72, 0, 1) forwards; }
      `}</style>
    </div>
  );
}

function AdjustButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-[color:var(--color-surface-2)] px-5 py-2.5 text-[15px] font-medium tnum text-white transition-colors active:bg-[color:var(--color-surface-3)]"
    >
      {children}
    </button>
  );
}

// Simple WebAudio beep — no asset required, works offline.
function beep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start();
    o.stop(ctx.currentTime + 0.55);
    if ("vibrate" in navigator) navigator.vibrate?.(200);
  } catch {
    /* noop */
  }
}
