import type { Workout } from "./types";

/**
 * The shape of a day.
 *
 * A morning is two distinct things, not one: five minutes of stretching to get
 * moving, then shoulder rehab. Folding them into a single "Morning PT" slot
 * meant one always displaced the other — you got the stretch or the cuff work,
 * never both, and the shoulder is the part that can't be skipped.
 *
 * Order is the order you do them in, and it's what the Today list and the
 * planner both sort by.
 */
export type SlotName = NonNullable<Workout["slot"]>;

export const SLOTS: {
  key: SlotName;
  label: string;
  emptyLabel: string;
  /** Rough budget, shown when the slot is empty so the ask is concrete. */
  hint: string;
}[] = [
  {
    key: "morning-stretch",
    label: "Morning stretch",
    emptyLabel: "Choose a stretch routine",
    hint: "5 min",
  },
  {
    key: "morning-pt",
    label: "Shoulder PT",
    emptyLabel: "Choose a PT routine",
    hint: "10 min",
  },
  {
    key: "strength",
    label: "Workout",
    emptyLabel: "Choose a workout",
    hint: "",
  },
];

const ORDER: Record<SlotName, number> = {
  "morning-stretch": 0,
  "morning-pt": 1,
  strength: 2,
};

/** Sort key. Anything without a slot is legacy data and sorts last. */
export function slotOrder(slot: Workout["slot"]): number {
  return slot ? ORDER[slot] : ORDER.strength + 1;
}

/** The two morning slots. Neither is "the workout for the day". */
export function isMorningSlot(slot: Workout["slot"]): boolean {
  return slot === "morning-stretch" || slot === "morning-pt";
}
