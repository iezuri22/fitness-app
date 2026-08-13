import { useMemo, useState } from "react";
import type { Exercise } from "../lib/types";
import ExerciseGif from "./ExerciseGif";
import { Tag } from "./ui";

/**
 * Modal for picking an exercise from the catalog to add to the current
 * workout. Shared between PlanEditor (pre-workout planning) and the live
 * Workout page (mid-workout additions).
 */
export default function ExercisePicker({
  exercises,
  existingExerciseIds,
  onPick,
  onClose,
  title = "Add exercise",
}: {
  exercises: Exercise[];
  existingExerciseIds: Set<string>;
  onPick: (ex: Exercise) => void | Promise<void>;
  onClose: () => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? exercises.filter((e) => e.name.toLowerCase().includes(q))
      : exercises;
    return [...list].sort((a, b) => {
      const aPT = a.isPT ? 0 : 1;
      const bPT = b.isPT ? 0 : 1;
      if (aPT !== bPT) return aPT - bPT;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, query]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up flex max-h-[85vh] w-full flex-col rounded-t-[16px] bg-[color:var(--color-surface)] sm:max-w-md sm:rounded-[16px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-separator)] p-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[color:var(--color-muted)] active:opacity-60"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="border-b border-[color:var(--color-separator)] p-4">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] outline-none placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[15px] text-[color:var(--color-muted)]">
              No matches.
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-separator)]">
              {filtered.map((ex) => {
                const already = existingExerciseIds.has(ex.id);
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => void onPick(ex)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                    >
                      <ExerciseGif name={ex.name} gifUrl={ex.gifUrl} size="thumb" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{ex.name}</div>
                        <div className="text-xs text-[color:var(--color-muted)] flex items-center gap-2 mt-0.5">
                          {ex.isPT && <Tag variant="accent">PT/Rehab</Tag>}
                          {already && <span className="italic">already in workout</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
