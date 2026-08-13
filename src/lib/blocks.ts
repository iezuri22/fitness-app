import type { PlannedSet, Workout } from "./types";

/**
 * A "block" is one unit in the workout UI — either a single exercise or a
 * superset of 2+ exercises that are meant to be performed back-to-back.
 *
 * Blocks are derived from `workout.plannedSets` using:
 *   - contiguous runs of same `exerciseId` with no supersetGroupId → single block
 *   - contiguous runs of sets sharing the same supersetGroupId (possibly
 *     across multiple exercises) → superset block
 *
 * The `plannedSets` array MUST stay grouped — i.e. all sets of exercise A
 * followed by all sets of exercise B in a superset. The workout renderer
 * interleaves them visually; the stored order is kept grouped to make
 * non-superset logic (patch, add, remove) simple.
 */

export type Block =
  | {
      kind: "exercise";
      exerciseId: string;
      exerciseName: string;
      sets: PlannedSet[];
      /** Index in the array of all blocks — useful for reorder affordances. */
      index: number;
    }
  | {
      kind: "superset";
      supersetGroupId: string;
      /** Exercises that make up this superset, in the order they appear. */
      members: { exerciseId: string; exerciseName: string; sets: PlannedSet[] }[];
      index: number;
    };

export function buildBlocks(w: Workout): Block[] {
  const blocks: Block[] = [];
  const sorted = [...w.plannedSets].sort((a, b) => a.order - b.order);

  // First group contiguous sets by (supersetGroupId|exerciseId).
  type Run = {
    key: string;
    supersetGroupId?: string;
    exerciseId: string;
    exerciseName: string;
    sets: PlannedSet[];
  };
  const runs: Run[] = [];
  for (const s of sorted) {
    const key = s.supersetGroupId
      ? `ss:${s.supersetGroupId}:${s.exerciseId}`
      : `ex:${s.exerciseId}`;
    const last = runs[runs.length - 1];
    if (last && last.key === key) {
      last.sets.push(s);
    } else {
      runs.push({
        key,
        supersetGroupId: s.supersetGroupId,
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        sets: [s],
      });
    }
  }

  // Now collapse consecutive runs sharing supersetGroupId into a superset block.
  let i = 0;
  let blockIndex = 0;
  while (i < runs.length) {
    const r = runs[i];
    if (!r.supersetGroupId) {
      blocks.push({
        kind: "exercise",
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        sets: r.sets,
        index: blockIndex++,
      });
      i += 1;
      continue;
    }
    const members: {
      exerciseId: string;
      exerciseName: string;
      sets: PlannedSet[];
    }[] = [];
    const gid = r.supersetGroupId;
    while (i < runs.length && runs[i].supersetGroupId === gid) {
      const rr = runs[i];
      members.push({
        exerciseId: rr.exerciseId,
        exerciseName: rr.exerciseName,
        sets: rr.sets,
      });
      i += 1;
    }
    blocks.push({
      kind: "superset",
      supersetGroupId: gid,
      members,
      index: blockIndex++,
    });
  }

  return blocks;
}

/**
 * Interleave superset sets for execution order: A1, B1, A2, B2, A3, B3, ...
 * Returns flat list of { set, memberIndex, round } so the renderer can label
 * rounds and decorate alternating rows.
 */
export function interleaveSupersetSets(block: Extract<Block, { kind: "superset" }>) {
  const maxLen = Math.max(...block.members.map((m) => m.sets.length));
  const out: {
    set: PlannedSet;
    memberIndex: number;
    memberName: string;
    round: number;
  }[] = [];
  for (let round = 0; round < maxLen; round++) {
    for (let mi = 0; mi < block.members.length; mi++) {
      const s = block.members[mi].sets[round];
      if (s) {
        out.push({
          set: s,
          memberIndex: mi,
          memberName: block.members[mi].exerciseName,
          round,
        });
      }
    }
  }
  return out;
}

/**
 * Move a block up or down by swapping it with the adjacent block. Returns the
 * new full `plannedSets` array (with updated `order` values) ready to save.
 */
export function moveBlock(
  w: Workout,
  blockIndex: number,
  direction: "up" | "down"
): PlannedSet[] {
  const blocks = buildBlocks(w);
  const target = blocks[blockIndex];
  const swapWith = blocks[blockIndex + (direction === "up" ? -1 : 1)];
  if (!target || !swapWith) return w.plannedSets;

  const setsInBlock = (b: Block): PlannedSet[] =>
    b.kind === "exercise" ? b.sets : b.members.flatMap((m) => m.sets);

  // Rebuild the set array in the new block order.
  const reordered: PlannedSet[] = [];
  blocks.forEach((b) => {
    if (b.index === target.index) reordered.push(...setsInBlock(swapWith));
    else if (b.index === swapWith.index) reordered.push(...setsInBlock(target));
    else reordered.push(...setsInBlock(b));
  });
  // Renumber `order` sequentially so future moves stay clean.
  return reordered.map((s, i) => ({ ...s, order: i + 1 }));
}

/**
 * Move a block to an arbitrary target block index. `toBlockIndex` is the
 * position the block should occupy AFTER the move (0-indexed over the existing
 * block list, EXCLUDING the moved block). Returns reordered plannedSets with
 * fresh sequential `order` values.
 */
export function moveBlockToIndex(
  w: Workout,
  fromBlockIndex: number,
  toBlockIndex: number
): PlannedSet[] {
  const blocks = buildBlocks(w);
  if (fromBlockIndex < 0 || fromBlockIndex >= blocks.length) return w.plannedSets;
  const moving = blocks[fromBlockIndex];
  const rest = blocks.filter((_, i) => i !== fromBlockIndex);
  const clampedTo = Math.max(0, Math.min(toBlockIndex, rest.length));
  const newOrder: Block[] = [
    ...rest.slice(0, clampedTo),
    moving,
    ...rest.slice(clampedTo),
  ];
  const setsInBlock = (b: Block): PlannedSet[] =>
    b.kind === "exercise" ? b.sets : b.members.flatMap((m) => m.sets);
  const flat = newOrder.flatMap(setsInBlock);
  return flat.map((s, i) => ({ ...s, order: i + 1 }));
}

/**
 * Create a superset between two arbitrary blocks (by index). If the blocks
 * aren't adjacent, the second block is first moved to sit directly after the
 * first, then both blocks are linked under one supersetGroupId.
 */
export function linkBlocksAsSuperset(
  w: Workout,
  blockIndexA: number,
  blockIndexB: number
): PlannedSet[] {
  if (blockIndexA === blockIndexB) return w.plannedSets;
  const blocks = buildBlocks(w);
  if (!blocks[blockIndexA] || !blocks[blockIndexB]) return w.plannedSets;

  // Move B to sit right after A. After the move, A may have shifted index if
  // B was before it — so compute the new indices carefully.
  let workingSets: PlannedSet[];
  let firstIdxAfterMove: number;
  if (blockIndexB === blockIndexA + 1) {
    // Already adjacent in the desired order — no move needed.
    workingSets = w.plannedSets;
    firstIdxAfterMove = blockIndexA;
  } else if (blockIndexB > blockIndexA) {
    // B is after A — move B to A+1.
    workingSets = moveBlockToIndex(w, blockIndexB, blockIndexA + 1);
    firstIdxAfterMove = blockIndexA;
  } else {
    // B is before A — move B to sit right after A. After removing B, A's
    // index shifts down by 1, so the target position is A (so B sits after).
    workingSets = moveBlockToIndex(w, blockIndexB, blockIndexA);
    firstIdxAfterMove = blockIndexA - 1;
  }

  return linkAsSuperset({ ...w, plannedSets: workingSets }, firstIdxAfterMove);
}

/**
 * Link two adjacent blocks into a superset. If either block is already a
 * superset, the other block is folded into that existing supersetGroupId.
 * Otherwise, a new group id is minted.
 */
export function linkAsSuperset(
  w: Workout,
  firstBlockIndex: number
): PlannedSet[] {
  const blocks = buildBlocks(w);
  const a = blocks[firstBlockIndex];
  const b = blocks[firstBlockIndex + 1];
  if (!a || !b) return w.plannedSets;

  const existingGid =
    (a.kind === "superset" && a.supersetGroupId) ||
    (b.kind === "superset" && b.supersetGroupId) ||
    null;
  const gid = existingGid ?? `ss_${crypto.randomUUID().slice(0, 8)}`;

  const targetIds = new Set<string>();
  const collect = (block: Block) => {
    if (block.kind === "exercise") block.sets.forEach((s) => targetIds.add(s.id));
    else block.members.forEach((m) => m.sets.forEach((s) => targetIds.add(s.id)));
  };
  collect(a);
  collect(b);

  return w.plannedSets.map((s) =>
    targetIds.has(s.id) ? { ...s, supersetGroupId: gid } : s
  );
}

/**
 * Link 2+ blocks into a single superset. Blocks are moved to sit contiguously
 * in the order given (first index stays put, others move in after it), then
 * all sets are tagged with a shared supersetGroupId. If any of the target
 * blocks is already a superset, its existing gid is reused.
 */
export function linkMultipleBlocksAsSuperset(
  w: Workout,
  blockIndices: number[]
): PlannedSet[] {
  if (blockIndices.length < 2) return w.plannedSets;

  const blocks = buildBlocks(w);
  // Dedup and validate.
  const seen = new Set<number>();
  const uniq = blockIndices.filter((i) => {
    if (seen.has(i) || !blocks[i]) return false;
    seen.add(i);
    return true;
  });
  if (uniq.length < 2) return w.plannedSets;

  // Pull target blocks out and re-insert them back-to-back at the position of
  // the first index (adjusted for any blocks removed before it).
  const anchorOriginal = uniq[0];
  const toMove = new Set(uniq);

  // Non-moved blocks before the anchor stay as-is; non-moved blocks after
  // the anchor shift right. The moved group sits together at the anchor's
  // original spot (in the order the user tapped them).
  const before: Block[] = [];
  const after: Block[] = [];
  const movedInOrder: Block[] = uniq.map((i) => blocks[i]);
  blocks.forEach((b, i) => {
    if (toMove.has(i)) return;
    if (i < anchorOriginal) before.push(b);
    else after.push(b);
  });

  const newOrderBlocks = [...before, ...movedInOrder, ...after];

  // Reuse an existing gid if any of the target blocks is already a superset.
  const existingGid =
    movedInOrder
      .map((b) => (b.kind === "superset" ? b.supersetGroupId : null))
      .find((g): g is string => typeof g === "string") ||
    `ss_${crypto.randomUUID().slice(0, 8)}`;

  const movedIds = new Set<string>();
  const collect = (block: Block) => {
    if (block.kind === "exercise")
      block.sets.forEach((s) => movedIds.add(s.id));
    else block.members.forEach((m) => m.sets.forEach((s) => movedIds.add(s.id)));
  };
  movedInOrder.forEach(collect);

  const setsInBlock = (b: Block): PlannedSet[] =>
    b.kind === "exercise" ? b.sets : b.members.flatMap((m) => m.sets);

  const flat = newOrderBlocks.flatMap(setsInBlock);
  return flat.map((s, i) => ({
    ...s,
    order: i + 1,
    supersetGroupId: movedIds.has(s.id) ? existingGid : s.supersetGroupId,
  }));
}

/** Remove superset grouping from a block — all its sets become sequential again. */
export function unlinkSuperset(
  w: Workout,
  blockIndex: number
): PlannedSet[] {
  const blocks = buildBlocks(w);
  const b = blocks[blockIndex];
  if (!b || b.kind !== "superset") return w.plannedSets;
  const ids = new Set<string>();
  b.members.forEach((m) => m.sets.forEach((s) => ids.add(s.id)));
  return w.plannedSets.map((s) =>
    ids.has(s.id) ? { ...s, supersetGroupId: undefined } : s
  );
}
