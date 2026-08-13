import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { getSeed, type SeedVariant } from "../lib/seedExercises";
import { Button, Card } from "../components/ui";

export default function Onboarding() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState<SeedVariant | null>(null);

  async function pick(variant: SeedVariant) {
    if (!user || busy) return;
    setBusy(variant);
    try {
      const path = `users/${user.uid}/exercises`;
      const batch = writeBatch(db);
      const now = Date.now();
      for (const ex of getSeed(variant)) {
        const ref = doc(collection(db, path));
        batch.set(ref, { ...ex, createdAt: now, updatedAt: now });
      }
      await batch.commit();
      nav("/", { replace: true });
    } catch (e) {
       
      console.warn("[onboarding] seed failed:", e);
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 pb-12 pt-12">
      <div>
        <img src="/favicon.svg" alt="" aria-hidden="true" className="mb-5 size-12 rounded-[12px]" />
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">
          Welcome to Lift
        </h1>
        <p className="mt-1 text-[15px] leading-snug text-[color:var(--color-muted)]">
          Pick a starter exercise library. You can edit anything later — this
          just saves you from starting empty.
        </p>
      </div>

      <div className="space-y-3">
        <Card onClick={() => pick("generic")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em]">Generic starter</div>
              <div className="mt-1 text-[15px] leading-snug text-[color:var(--color-muted)]">
                A clean ~30 exercise library: push-up, squat, row, curl,
                deadlift, plank, and common home / gym movements. No
                restrictions.
              </div>
            </div>
            {busy === "generic" ? <Spinner /> : <Arrow />}
          </div>
          <div className="mt-3 text-[13px] text-[color:var(--color-muted)]">
            Best for most people.
          </div>
        </Card>

        <Card onClick={() => pick("shoulder-safe")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.01em]">
                Shoulder-safe (post-surgery)
              </div>
              <div className="mt-1 text-[15px] leading-snug text-[color:var(--color-muted)]">
                Rotator cuff + scapular stability PT block, shoulder-safe lifts,
                and 5 banned exercises pre-flagged (behind-the-neck press,
                wide-grip pull-up, deep fly, side plank with rotation, cold OH
                press).
              </div>
            </div>
            {busy === "shoulder-safe" ? <Spinner /> : <Arrow />}
          </div>
          <div className="mt-3 text-[13px] text-[color:var(--color-muted)]">
            Built for post-Latarjet recovery. Still useful if you have any
            shoulder instability.
          </div>
        </Card>
      </div>

      <div className="pt-2 text-center text-[13px] leading-snug text-[color:var(--color-muted)]">
        Not sure? Start with Generic. You can delete everything and re-seed from
        the Exercises tab later.
      </div>

      <Button
        variant="ghost"
        onClick={() => nav("/", { replace: true })}
        disabled={!!busy}
        block
        className="!text-[15px] !text-[color:var(--color-muted)]"
      >
        Skip — I'll build my library from scratch
      </Button>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-1 shrink-0 text-[color:var(--color-muted-2)]"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin text-[color:var(--color-accent)] shrink-0 mt-1"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
