import { useEffect, useRef, useState } from "react";
import type { PlannedSet } from "../lib/types";

/**
 * Full-screen overlay that runs a single set's work→rest timer. On work end:
 * plays an alarm + vibration, auto-marks the set complete, moves to rest. On
 * rest end: plays alarm again and closes. User can pause, skip, or cancel.
 *
 * This is the per-set ▶ button experience — distinct from the global
 * IntervalTimer which walks through ALL incomplete sets sequentially.
 */
export default function SingleSetTimer({
  set,
  onComplete,
  onClose,
}: {
  set: PlannedSet;
  onComplete: (set: PlannedSet) => void;
  onClose: () => void;
}) {
  const workSeconds = set.workSeconds ?? 45;
  const restSeconds = set.restSeconds ?? 0;

  const [phase, setPhase] = useState<"work" | "rest" | "done">("work");
  const [remaining, setRemaining] = useState(workSeconds);
  const [paused, setPaused] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [paused, phase]);

  useEffect(() => {
    if (remaining > 0) return;
    // Phase transition
    if (phase === "work") {
      playAlarm();
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete(set);
      }
      if (restSeconds > 0) {
        setPhase("rest");
        setRemaining(restSeconds);
      } else {
        setPhase("done");
      }
    } else if (phase === "rest") {
      playAlarm();
      setPhase("done");
    }
  }, [remaining, phase, restSeconds, set, onComplete]);

  useEffect(() => {
    if (phase === "done") {
      const id = setTimeout(() => onClose(), 800);
      return () => clearTimeout(id);
    }
  }, [phase, onClose]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const isWork = phase === "work";

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center ${
        isWork ? "bg-[color:var(--color-accent)]" : "bg-black"
      }`}
    >
      <div className="mb-3 text-[17px] font-medium text-white/70">
        {phase === "work" ? "Work" : phase === "rest" ? "Rest" : "Done"}
      </div>
      <div
        className="font-semibold tnum leading-none tracking-[-0.03em] text-white"
        style={{ fontSize: "min(32vw, 180px)" }}
      >
        {mm}:{ss.toString().padStart(2, "0")}
      </div>
      <div className="mt-4 max-w-full truncate px-8 text-center text-[15px] text-white/70">
        {set.exerciseName} · {set.targetReps}
        {set.targetWeight ? ` @ ${set.targetWeight} lb` : ""}
      </div>

      {phase !== "done" && (
        <div className="mt-10 flex items-center gap-2.5">
          <TimerAction onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </TimerAction>
          <TimerAction onClick={() => setRemaining(0)}>Skip</TimerAction>
          <TimerAction onClick={onClose}>Cancel</TimerAction>
        </div>
      )}
    </div>
  );
}

/** Translucent control on the full-bleed timer — works on blue or on black. */
function TimerAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-white/15 px-5 py-2.5 text-[15px] font-medium text-white transition-colors active:bg-white/25"
    >
      {children}
    </button>
  );
}

function playAlarm() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [
      { f: 880, t: now },
      { f: 1175, t: now + 0.18 },
    ].forEach(({ f, t }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.17);
    });
  } catch {
    // swallow — audio not critical
  }
  if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
}
