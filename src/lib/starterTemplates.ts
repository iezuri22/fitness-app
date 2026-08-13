/**
 * Starter pack: 26 shoulder-safe workout templates built for a post-Latarjet
 * home setup (dumbbells, kettlebells, bands, pulley, foam roller).
 *
 * Goals encoded in the mix:
 *   - 6 PT days + 4 Full days per week → pack has 14 PT-only templates
 *     (including 6 pure morning-stretch / mobility flows) and 12 Full
 *     templates so the user has plenty of variety across multiple weeks.
 *   - Every Full template opens with pulleys, includes ≥3 PT sets, and ends
 *     with a running block (treadmill or outdoor) per user preference.
 *   - Band External Rotation appears early in every Full workout.
 *   - No push-ups, no behind-the-neck pressing, no deep chest flyes.
 *
 * Exercise names MUST match the catalog in src/lib/notionExercises.ts — the
 * seeder resolves them against the user's live /exercises collection by
 * normalized name. Anything missing is skipped with a warning.
 */

import type { PlannedSet, TemplateCategory, WorkoutFormat } from "./types";

type SeedSet = {
  name: string;                 // catalog exercise name
  reps: number;
  weight?: number;              // lbs — omit for bodyweight / band
  setType?: PlannedSet["setType"];
  rest?: number;                // seconds
  workSeconds?: number;         // for timed holds / cardio
  supersetKey?: string;         // any sets sharing a key become one superset
  cue?: string;                 // coaching cue shown under the exercise name
};

type SeedTemplate = {
  name: string;
  focus: string;
  category: TemplateCategory;
  notes?: string;               // shown on the workout — rep ranges, cues, etc.
  /** "amrap" → `sets` describes ONE round, scored by rounds completed. */
  format?: WorkoutFormat;
  capMinutes?: number;          // AMRAP time cap
  sets: SeedSet[][];            // outer array = blocks; each inner = one exercise's sets
};

/** One round of an AMRAP: a single set per movement, no rest between them. */
const round = (name: string, reps: number, weight?: number, cue?: string): SeedSet[] => [
  { name, reps, weight, setType: "Working" as const, rest: 0, cue },
];

// Shorthand builders
const pt = (name: string, reps: number, sets = 3, rest = 30, cue?: string): SeedSet[] =>
  Array.from({ length: sets }, () => ({
    name,
    reps,
    setType: "PT/Rehab" as const,
    rest,
    cue,
  }));

const working = (
  name: string,
  reps: number,
  weight: number | undefined,
  sets: number,
  rest = 75,
  cue?: string
): SeedSet[] =>
  Array.from({ length: sets }, () => ({
    name,
    reps,
    weight,
    setType: "Working" as const,
    rest,
    cue,
  }));

/** Superset member — everything sharing a key is performed alternating. */
const ss = (
  key: string,
  name: string,
  reps: number,
  sets: number,
  rest: number,
  cue?: string
): SeedSet[] =>
  Array.from({ length: sets }, () => ({
    name,
    reps,
    setType: "Working" as const,
    rest,
    supersetKey: key,
    cue,
  }));

const stretch = (name: string, reps = 1, rest = 0, cue?: string): SeedSet[] => [
  { name, reps, setType: "Stretch" as const, rest, cue },
];

/**
 * A timed stretch hold. Unlike `stretch()` this carries `workSeconds`, which
 * does two things: the set gets a ▶ countdown button during the session, and
 * the duration estimate becomes exact instead of the 33s-per-set default.
 *
 * That precision is the point for the short mobility flows — they're built to
 * total 5 or 10 minutes, and the Library filters on that number.
 */
const hold = (name: string, seconds: number, cue?: string): SeedSet[] => [
  { name, reps: 1, setType: "Stretch" as const, rest: 0, workSeconds: seconds, cue },
];

// The 20 templates.
export const STARTER_TEMPLATES: SeedTemplate[] = [
  // ---------- MORNING ROUTINES ----------
  // Built around a real constraint: spinal discs rehydrate overnight, and
  // bending a freshly-hydrated spine spikes disc stress (~300%) and ligament
  // stress (~80%). So mornings lead with EXTENSION and neutral-spine work —
  // no deep forward folds, no loaded rounding. Flexion-heavy stretches live in
  // the evening routines instead. McGill's guidance: give it ~30 min after
  // waking before doing spine work, and use Cat-Cow as gentle motion (5-6
  // slow cycles) rather than an end-range stretch.
  {
    name: "AM · Wake Up 5",
    focus: "Morning · 5 min",
    category: "PT Only",
    notes:
      "Straight out of bed. Extension and neutral-spine only — your discs are at their most hydrated right now, so no deep forward folds for the first half hour.",
    sets: [
      stretch("Bhujangasana — Cobra Abdominal Stretch", 1, 0, "Gentle press-up. Hips stay down, no forcing — 5 slow reps."),
      pt("Cat-Cow Pose", 6, 1, 15, "Motion, not a stretch. 6 slow cycles to move fluid through the discs."),
      pt("Band External Rotation", 12, 2, 15, "Elbow pinned to your side. Wakes the cuff before anything else loads it."),
      stretch("Doorway Chest Stretch", 1, 0, "Undo the night's side-sleeping. Breathe into it, don't lean hard."),
    ],
  },
  {
    name: "AM · Spine + Shoulder 8",
    focus: "Morning · 8 min",
    category: "PT Only",
    notes:
      "The default morning. Extension-biased spine work, cuff activation, then McGill's stability trio — all neutral spine, no loaded flexion.",
    sets: [
      stretch("Bhujangasana — Cobra Abdominal Stretch", 1, 0, "5 slow press-ups. Extension first thing beats flexion."),
      pt("Cat-Cow Pose", 6, 1, 15, "6 easy cycles. Lubricate, don't stretch."),
      pt("Band External Rotation", 12, 2, 15, "Slow out, slower back."),
      pt("Bird Dog", 8, 2, 20, "Opposite arm and leg. Brace like someone's about to poke your ribs."),
      pt("Dead Bug", 10, 2, 20, "Low back glued to the floor the whole time."),
      stretch("Standing Quad Stretch", 1, 0, "Stand tall, knee down, glute squeezed."),
    ],
  },
  {
    name: "AM · Hips + Posture 10",
    focus: "Morning · 10 min",
    category: "PT Only",
    notes:
      "For days you'll be sitting a lot. Opens hips and chest without rounding the spine early.",
    sets: [
      stretch("Bhujangasana — Cobra Abdominal Stretch", 1, 0, "5 press-ups to start."),
      pt("Cat-Cow Pose", 6, 1, 15, "Slow cycles."),
      stretch("Kneeling Hip Flexor Stretch", 1, 0, "Squeeze the back glute — that's what makes it work."),
      stretch("World's Greatest Stretch", 1, 0, "Lunge, elbow to instep, rotate up and open."),
      pt("Band Pull-Apart", 15, 2, 15, "Shoulder blades to back pockets."),
      pt("Bird Dog", 8, 2, 20, "Slow and steady, no hip wobble."),
      stretch("Doorway Chest Stretch", 1, 0, "Finish tall."),
    ],
  },
  {
    name: "AM · Pre-Gym Primer",
    focus: "Morning · Before Lifting",
    category: "PT Only",
    notes:
      "Run this before a gym session. Cuff prep and scap activation so your first working set isn't the warm-up.",
    sets: [
      pt("Band External Rotation", 15, 2, 15, "High reps, light band. Blood in the cuff."),
      pt("Band Pull-Apart", 15, 2, 15, "Retract and hold a beat at the end."),
      pt("Scapular Wall Slides", 10, 2, 15, "Ribs down, arms glued to the wall."),
      pt("Shoulder CARs (slow)", 5, 1, 15, "One slow circle each side. Find the sticky spots."),
    ],
  },

  // ---------- EVENING / WIND-DOWN ----------
  // Static holds 30-60s with slow nasal breathing — that combination drives
  // parasympathetic (rest-and-digest) activation via the vagus nerve, which is
  // what actually helps you fall asleep. Best done 30-60 min before bed.
  // Flexion is fine here: the discs have been loaded all day.
  {
    name: "PM · Wind Down 6",
    focus: "Evening · 6 min",
    category: "PT Only",
    notes:
      "30-60 minutes before bed. Long holds, slow nasal breathing — 4 seconds in, 6 out. The breathing is the active ingredient, not the stretch.",
    sets: [
      stretch("Child's Pose", 1, 0, "Hold 60s. Breathe into your back ribs."),
      stretch("Ardha Kapotasana - Half Pigeon Pose", 1, 0, "45s each side. Let the hip melt, don't push."),
      stretch("Titli Asana — Butterfly Pose", 1, 0, "Hold 60s. Knees heavy, no bouncing."),
    ],
  },
  {
    name: "PM · Full Wind Down 10",
    focus: "Evening · 10 min",
    category: "PT Only",
    notes:
      "The full version. Every hold 45-60s with slow nasal breathing. If your mind wanders, count the exhales.",
    sets: [
      pt("Cat-Cow Pose", 8, 1, 10, "8 slow cycles to unwind the spine."),
      stretch("Child's Pose", 1, 0, "60s. Long exhales."),
      stretch("Figure Four Glute Stretch", 1, 0, "45s each side."),
      stretch("Ardha Kapotasana - Half Pigeon Pose", 1, 0, "45s each side."),
      stretch("Titli Asana — Butterfly Pose", 1, 0, "60s."),
      stretch("Standing Hamstring Stretch", 1, 0, "45s each. Soft knee."),
    ],
  },
  {
    name: "PM · Post-Lift Decompress",
    focus: "Evening · After Training",
    category: "PT Only",
    notes:
      "Straight after a gym session. Roll first, then hold — rolling before stretching lets the tissue actually lengthen.",
    sets: [
      pt("Foam Roll Quads", 10, 2, 15, "Slow passes. Pause on the sore spots and breathe."),
      pt("Foam Roll Hamstrings", 10, 2, 15, "Same — slow, not a massage race."),
      stretch("Kneeling Hip Flexor Stretch", 1, 0, "45s each side."),
      stretch("Figure Four Glute Stretch", 1, 0, "45s each side."),
      stretch("Child's Pose", 1, 0, "60s to finish."),
    ],
  },
  {
    name: "PM · Shoulder Night Care",
    focus: "Evening · Shoulder",
    category: "PT Only",
    notes:
      "For nights the shoulder is talking to you. All low-load — nothing here should reproduce pain. If it pinches, stop.",
    sets: [
      pt("Shoulder Pulley Stretch", 10, 2, 20, "Assisted range only. Let the good arm do the work."),
      pt("Foam Roller Thoracic Extension", 10, 2, 20, "Open the mid-back so the shoulder stops compensating."),
      stretch("Cross-Body Shoulder Stretch", 1, 0, "45s. Gentle — this is not a test of tolerance."),
      stretch("Doorway Chest Stretch", 1, 0, "45s, elbow at shoulder height, not above."),
    ],
  },

  // ---------- SHOULDER REHAB (non-negotiable daily work) ----------
  {
    name: "PT · Quick 6",
    focus: "Minimum Viable Rehab",
    category: "PT Only",
    notes: "The one you do when you don't want to. Six minutes, no excuses.",
    sets: [
      pt("Shoulder Pulley Stretch", 10, 2, 20, "Assisted range. Never force past a pinch."),
      pt("Band External Rotation", 12, 2, 20, "Elbow at your side, forearm sweeps out."),
      pt("Band Pull-Apart", 15, 2, 20, "Squeeze the blades, don't shrug."),
    ],
  },
  {
    name: "PT · Rotator Cuff Builder",
    focus: "Rotator Cuff Strength",
    category: "PT Only",
    notes:
      "The strength end of rehab. Slow eccentrics — 3 seconds returning on every rep. That's where the tendon adapts.",
    sets: [
      pt("Shoulder Pulley Stretch", 10, 2, 20, "Warm the joint first."),
      pt("External Rotation - Left", 15, 2, 20, "3 seconds back. Count it."),
      pt("External Rotation - Right", 15, 2, 20, "3 seconds back."),
      pt("Band Internal Rotation", 12, 2, 20, "Don't neglect this side — IR keeps the joint balanced."),
      stretch("Cross-Body Shoulder Stretch", 1, 0, "Easy finish."),
    ],
  },
  {
    name: "PT · Scapular Control",
    focus: "Scap + Posture",
    category: "PT Only",
    notes:
      "Your shoulder blade is the shoulder's foundation. Quality over reps — stop the set when form slips.",
    sets: [
      pt("Scapular Wall Slides", 10, 2, 20, "Ribs down. If your back arches, you've gone too high."),
      pt("Resisted Standing Row", 12, 2, 20, "Lead with the elbow, finish with the squeeze."),
      pt("Band Pull-Apart", 15, 2, 20, "Blades to back pockets."),
      pt("Scapular Retraction Hold", 15, 2, 20, "Hold 5 seconds at the end of each rep."),
      stretch("Doorway Chest Stretch", 1, 0),
    ],
  },
  {
    name: "PT · Isometric Day",
    focus: "Low-Load Holds",
    category: "PT Only",
    notes:
      "For flare-up days. Isometrics load the tendon without moving the joint — they often calm pain down rather than stir it up.",
    sets: [
      pt("Shoulder Pulley Stretch", 10, 2, 20, "Gentle range first."),
      pt("Wall Isometric Flexion - Left", 10, 2, 20, "Push into the wall at ~50% effort. Hold 10s."),
      pt("Isometric Shoulder External Rotation (wall)", 10, 2, 20, "Same — 50% effort, 10s holds."),
      pt("Resisted Standing Shoulder Extension", 12, 2, 20, "Straight arm back, squeeze the lat."),
      stretch("Overhead Tricep Stretch", 1, 0),
    ],
  },
  {
    name: "PT · Foam Roller Reset",
    focus: "Tissue Work",
    category: "PT Only",
    notes: "Roll slow. If you're rushing you're just bruising yourself.",
    sets: [
      pt("Foam Roller Thoracic Extension", 10, 2, 20, "Support your head, open the mid-back."),
      pt("Foam Roll Quads", 10, 2, 20, "Pause and breathe on tender spots."),
      pt("Foam Roll Hamstrings", 10, 2, 20),
      pt("Foam Roller Glutes", 10, 2, 20, "Cross the ankle over the knee to get in deeper."),
      stretch("Figure Four Glute Stretch", 1, 0),
    ],
  },
  {
    name: "PT · Core Foundation",
    focus: "Trunk Stability",
    category: "PT Only",
    notes:
      "McGill's Big 3, more or less. Neutral spine throughout — this builds a trunk that protects your back instead of a six-pack that doesn't.",
    sets: [
      pt("Dead Bug", 10, 2, 20, "Low back pinned. Slow beats many."),
      pt("Bird Dog", 8, 2, 20, "Hold 3 seconds at the top of each rep."),
      pt("Side Plank (Left)", 25, 2, 20, "Stack the hips. Quality seconds only."),
      pt("Side Plank (Right)", 25, 2, 20),
      stretch("Child's Pose", 1, 0),
    ],
  },
  {
    name: "PT · Desk Reset",
    focus: "5-Minute Posture Break",
    category: "PT Only",
    notes: "Between meetings. Chest open, blades working, done in five.",
    sets: [
      pt("Band Pull-Apart", 15, 2, 15, "Squeeze and hold a beat."),
      pt("Scapular Wall Slides", 10, 2, 15, "Ribs down."),
      stretch("Doorway Chest Stretch", 1, 0, "30s each side."),
      stretch("Cross-Body Shoulder Stretch", 1, 0),
    ],
  },
  {
    name: "PT · Ankle + Calf Mobility",
    focus: "Lower Leg Prep",
    category: "PT Only",
    notes: "Before squat or stair-master days — better depth, happier knees.",
    sets: [
      pt("Foam Roller Calves", 10, 2, 20, "Slow passes, both heads."),
      pt("Calf Stretch at Wall", 30, 2, 20, "Straight knee, then bent knee — different muscles."),
      stretch("Standing Hamstring Stretch", 1, 0),
    ],
  },

  // ---------- STRENGTH: GYM ----------
  // Programmed for hypertrophy, not just "some exercises": open with cardio to
  // get blood moving, prep the cuff, then heavy compound (6-10) → secondary
  // compound (10-12) → isolation (12-20) → a finisher using an intensity
  // technique. Shoulder rules throughout: neutral/close grips, nothing behind
  // the neck, no end-range stretch under load on the repaired side.
  {
    name: "Gym · Push — Pressure Test",
    focus: "Chest + Triceps · Gym",
    category: "Full",
    notes:
      "Chest day. First working set of every lift is the heaviest — leave 1-2 reps in the tank there, then chase the pump. Add 5lb whenever you hit the top of the rep range on all sets.",
    sets: [
      [{ name: "Stationary Bike", reps: 6, setType: "Warm-up", workSeconds: 360, rest: 0 }],
      pt("Band External Rotation", 15, 2, 20, "Non-negotiable before pressing. Light band, slow."),
      working("Machine Chest Press", 8, undefined, 4, 100, "Heaviest lift of the day. 2s down, explode up, stop 1-2 reps short of failure."),
      working("Incline Dumbbell Bench Press", 10, undefined, 3, 90, "Neutral-ish grip, elbows ~45°. Don't let them flare to 90 — that's the position your shoulder hates."),
      ss("A", "Pec Deck Fly", 14, 3, 30, "Partial range — stop where the stretch starts pulling at the front of the shoulder. Squeeze 1s."),
      ss("A", "Cable Lateral Raise", 15, 3, 75, "Superset with the fly. Lead with the elbow, no swinging."),
      working("Cable Rope Pushdown", 12, undefined, 3, 60, "Last set: drop the weight 30% and rep out. That's the finisher."),
      working("Dumbbell Close-grip Floor Press", 12, undefined, 2, 60, "Floor limits the range and spares the shoulder. Elbows tight."),
      stretch("Doorway Chest Stretch", 1, 0, "Elbow at shoulder height, never above."),
    ],
  },
  {
    name: "Gym · Pull — Wingspan",
    focus: "Back + Biceps · Gym",
    category: "Full",
    notes:
      "Width first, thickness second, arms last. Every rep starts by pulling the shoulder blade — if your biceps are doing the work, lighten it.",
    sets: [
      [{ name: "Stationary Bike", reps: 6, setType: "Warm-up", workSeconds: 360, rest: 0 }],
      working("Close-Grip Lat Pulldown (neutral)", 9, undefined, 4, 100, "Neutral grip only. Pull to the collarbone, 3s back up. Never behind the neck."),
      working("Chest-Supported Machine Row", 11, undefined, 3, 90, "Chest stays on the pad. Squeeze 1s at the back of every rep."),
      working("Cable Straight-Arm Pulldown", 15, undefined, 3, 60, "Pure lat isolation. Soft elbows, think 'push the bar down with your armpits'."),
      ss("B", "EZ-Bar Curl", 10, 3, 30, "Elbows pinned to your ribs. No swinging."),
      ss("B", "Cable Face Pull", 20, 3, 75, "Superset. High reps — this is shoulder insurance as much as rear delt work."),
      working("Cable Rope Hammer Curl", 15, undefined, 2, 60, "Final set: rest-pause. Go to near-failure, rest 15s, squeeze out 5 more."),
      stretch("Cross-Body Shoulder Stretch", 1, 0),
    ],
  },
  {
    name: "Gym · Legs — Tree Trunks",
    focus: "Quads · Gym",
    category: "Full",
    notes:
      "Quad-dominant and genuinely hard. Depth over load on every squat pattern — if you can't hit depth, the weight is wrong.",
    sets: [
      [{ name: "Stair Climber (StairMaster)", reps: 8, setType: "Warm-up", workSeconds: 480, rest: 0 }],
      working("Hack Squat (Machine)", 9, undefined, 4, 120, "3s down, no bounce out of the hole. This is the money lift."),
      working("Leg Press", 14, undefined, 3, 90, "Feet low and narrow to bias the quads. Don't lock out at the top."),
      working("Bulgarian Split Squat", 10, undefined, 3, 75, "Per leg. Torso upright = quads. Front knee travels over the toes, that's fine."),
      working("Leg Extension (Machine)", 15, undefined, 3, 60, "Last set is a double drop: fail, cut 30%, fail, cut 30% again, fail."),
      working("Standing Calf Raise (Machine)", 12, undefined, 4, 45, "2s pause at the bottom stretch, 1s squeeze at the top. Calves need time under tension."),
      stretch("Standing Quad Stretch", 1, 0),
    ],
  },
  {
    name: "Gym · Legs — Hinge Day",
    focus: "Hamstrings + Glutes · Gym",
    category: "Full",
    notes:
      "Posterior chain. Hinge, don't squat — push your hips back and feel the hamstrings load before anything bends at the knee.",
    sets: [
      [{ name: "Treadmill Incline Walk", reps: 8, setType: "Warm-up", workSeconds: 480, rest: 0 }],
      working("Trap Bar Deadlift", 6, undefined, 4, 120, "Heavy. Push the floor away, lock the lats in before you pull."),
      working("Barbell Hip Thrusts", 11, undefined, 4, 90, "Chin tucked, ribs down, 2s squeeze at the top. Glutes, not lower back."),
      working("Seated Leg Curl (Machine)", 13, undefined, 3, 60, "Last set myo-reps: 13 reps, then 4 mini-sets of 4 with 15s rest."),
      working("Reverse Hyperextension", 15, undefined, 3, 60, "Control the swing. Squeeze at the top, don't hyperextend the low back."),
      working("Seated Calf Raise (Machine)", 15, undefined, 3, 45, "Soleus work — knees bent means slow and high rep."),
      stretch("Standing Hamstring Stretch", 1, 0),
    ],
  },
  {
    name: "Gym · Arms — Sleeve Buster",
    focus: "Biceps + Triceps · Gym",
    category: "Full",
    notes:
      "Antagonist supersets the whole way — biceps recover while triceps work, so you get double the volume in the same time. Chase the pump, keep the elbows quiet.",
    sets: [
      [{ name: "Stationary Bike", reps: 5, setType: "Warm-up", workSeconds: 300, rest: 0 }],
      ss("A", "EZ-Bar Curl", 10, 4, 30, "Heaviest curl of the day. Full stretch at the bottom."),
      ss("A", "Triceps Pushdown (V-Bar)", 12, 4, 75, "Elbows glued to your sides, full lockout."),
      ss("B", "Machine Preacher Curl", 12, 3, 30, "Preacher pad kills the swing. Slow negative."),
      ss("B", "EZ-Bar Skull Crusher", 12, 3, 75, "Lower to the forehead, keep the upper arms still."),
      ss("C", "Cable Rope Hammer Curl", 15, 3, 30, "Brachialis — this is what pushes the bicep up."),
      ss("C", "Cable Incline Pushdown", 15, 3, 60, "Lean in, stretch the long head."),
      working("Dumbbell Zottman Curl", 12, undefined, 2, 45, "Up normal, rotate, down reverse-grip. Brutal forearm finisher."),
    ],
  },
  {
    name: "Gym · Delts — Cannonballs",
    focus: "Shoulders · Gym",
    category: "Full",
    notes:
      "Side delts are what make you look wide, and they respond to volume, not load. Everything here is shoulder-safe: neutral grip pressing, no behind-neck, nothing overhead until the cuff is warm.",
    sets: [
      [{ name: "Stationary Bike", reps: 5, setType: "Warm-up", workSeconds: 300, rest: 0 }],
      pt("Band External Rotation", 15, 2, 20, "Cuff first. Always."),
      pt("Band Pull-Apart", 15, 2, 20, "Wake the rear delts up."),
      working("Machine Shoulder Press (neutral grip)", 10, undefined, 4, 90, "Neutral grip, stop just short of lockout. If it pinches, reduce the range."),
      working("Cable Lateral Raise", 15, undefined, 4, 60, "The main event. Constant tension — never let the cable go slack."),
      working("Seated Lateral Raise", 12, undefined, 3, 60, "Last set: full reps to failure, then partials in the bottom half until you can't."),
      working("Reverse Pec Deck", 20, undefined, 3, 45, "High reps. Rear delts are postural — they can take it."),
      working("Front Plate Raise", 15, undefined, 2, 45, "Only to shoulder height. No higher."),
      stretch("Cross-Body Shoulder Stretch", 1, 0),
    ],
  },
  {
    name: "Gym · Upper — Power Build",
    focus: "Upper Body · Gym",
    category: "Full",
    notes:
      "One heavy push, one heavy pull, then volume. The best bang-for-buck upper day if you only get two gym sessions this week.",
    sets: [
      [{ name: "Rowing Machine (Erg)", reps: 6, setType: "Warm-up", workSeconds: 360, rest: 0 }],
      pt("Band External Rotation", 15, 2, 20, "Cuff prep."),
      working("Machine Chest Press", 8, undefined, 4, 100, "Heavy and controlled."),
      working("Close-Grip Lat Pulldown (neutral)", 9, undefined, 4, 100, "Match the press for volume — balanced shoulders stay healthy."),
      ss("A", "Incline Dumbbell Bench Press", 11, 3, 30, "Elbows at 45°."),
      ss("A", "Chest-Supported Machine Row", 11, 3, 90, "Superset. Squeeze at the back."),
      ss("B", "Cable Lateral Raise", 15, 3, 30, "Constant tension."),
      ss("B", "Cable Face Pull", 20, 3, 60, "Shoulder health finisher."),
      stretch("Doorway Chest Stretch", 1, 0),
    ],
  },
  {
    name: "Gym · Full Body — Density 45",
    focus: "Full Body · Gym",
    category: "Full",
    notes:
      "Everything in 45 minutes using paired supersets. Keep the rest honest — the density is the stimulus.",
    sets: [
      [{ name: "Stair Climber (StairMaster)", reps: 6, setType: "Warm-up", workSeconds: 360, rest: 0 }],
      pt("Band External Rotation", 15, 2, 20),
      ss("A", "Hack Squat (Machine)", 10, 3, 30, "Deep and controlled."),
      ss("A", "Close-Grip Lat Pulldown (neutral)", 10, 3, 90, "Superset — legs rest while the back works."),
      ss("B", "Barbell Romanian Deadlift", 10, 3, 30, "Hips back, bar close to the legs."),
      ss("B", "Machine Chest Press", 10, 3, 90, "Superset."),
      ss("C", "Cable Lateral Raise", 15, 3, 30),
      ss("C", "Cable Crunch", 15, 3, 60, "Round the spine here deliberately — that's the point of the movement."),
      stretch("Figure Four Glute Stretch", 1, 0),
    ],
  },
  {
    name: "Gym · Conditioning — Sled + Carry",
    focus: "Conditioning · Gym",
    category: "Full",
    notes:
      "Finisher day, or bolt the last three onto any session. All joint-friendly — no eccentric loading, so it won't wreck you for the next lift.",
    sets: [
      [{ name: "Rowing Machine (Erg)", reps: 5, setType: "Warm-up", workSeconds: 300, rest: 0 }],
      working("Sled Push", 1, undefined, 5, 60, "One length, hard. Low body angle, drive through the legs."),
      working("Sled Backward Drag", 1, undefined, 4, 60, "Walking backwards. Your quads will hate you and your knees will thank you."),
      working("Farmer's Walk", 1, undefined, 4, 60, "Heavy as you can hold. Ribs down, shoulders back, walk tall."),
      working("Kettlebell Swings", 15, undefined, 3, 60, "Hips snap, arms are just rope. Don't squat it."),
      stretch("Child's Pose", 1, 0),
    ],
  },

  // ---------- STRENGTH: HOME (dumbbells, kettlebells, bands) ----------
  {
    name: "Home · Push — Floor Work",
    focus: "Chest + Triceps · Home",
    category: "Full",
    notes:
      "Floor pressing is the shoulder-safe way to train chest hard at home — the floor stops your elbow going past your torso, which is exactly the position to protect.",
    sets: [
      pt("Band External Rotation", 15, 2, 20, "Cuff prep."),
      working("Dumbbell Floor Press", 10, undefined, 4, 90, "Pause when the triceps touch the floor. No bouncing."),
      working("Single-arm Dumbbell Floor Press", 10, undefined, 3, 75, "One side at a time — the anti-rotation is free core work."),
      ss("A", "Band Chest Fly (shallow range)", 15, 3, 30, "Shallow. Stop well before the stretch bites at the shoulder."),
      ss("A", "Band Lateral Raise", 15, 3, 60, "Superset."),
      working("Dumbbell Close-grip Floor Press", 12, undefined, 3, 60, "Elbows tucked, triceps do the work."),
      working("Dumbbell Tate Press", 12, undefined, 2, 45, "Elbows flared out, press from the chest. Weird-feeling, brutal on the triceps."),
      stretch("Doorway Chest Stretch", 1, 0),
    ],
  },
  {
    name: "Home · Pull — Row Boat",
    focus: "Back + Biceps · Home",
    category: "Full",
    notes:
      "No pull-up bar needed. Rows from every angle, then arms. Pull with the elbow, not the hand.",
    sets: [
      pt("Band Pull-Apart", 15, 2, 20, "Wake the scaps."),
      working("Dumbbell Single-arm Row", 11, undefined, 4, 75, "Per side. Drive the elbow to the hip, squeeze 1s."),
      working("Band Lat Pulldown (kneeling)", 14, undefined, 3, 60, "Tall kneeling. Pull to the collarbone."),
      working("Dumbbell Chest-supported Row", 12, undefined, 3, 60, "Chest down — takes the low back out entirely."),
      working("Band Straight-arm Pulldown", 15, undefined, 3, 45, "Lat isolation, soft elbows."),
      ss("A", "Dumbbell Hammer Curl", 12, 3, 30, "Thumbs up, no swing."),
      ss("A", "Band Rear Delt Fly", 20, 3, 60, "Superset. High reps."),
      working("Dumbbell Drag Curl", 12, undefined, 2, 45, "Drag the dumbbells up your torso — keeps tension on the bicep the whole way."),
    ],
  },
  {
    name: "Home · Legs — No Bar Needed",
    focus: "Legs + Glutes · Home",
    category: "Full",
    notes:
      "Unilateral work and tempo make bodyweight-ish loads genuinely hard. Slow eccentrics are the whole trick here.",
    sets: [
      [{ name: "Jump Rope", reps: 4, setType: "Warm-up", workSeconds: 240, rest: 0 }],
      working("Dumbbell Bulgarian Split Squat", 10, undefined, 4, 75, "Per leg. 3s down. This is the hardest thing you'll do today."),
      working("Kettlebell Goblet Squat", 14, undefined, 3, 75, "Elbows inside the knees at the bottom, chest tall."),
      working("Dumbbell Romanian Deadlift", 12, undefined, 3, 75, "Hips back, soft knees. Feel the hamstrings, not the back."),
      ss("A", "Kettlebell Hip Thrust", 15, 3, 30, "2s squeeze at the top."),
      ss("A", "Cossack Squat", 8, 3, 60, "Per side. Sit into one hip, other leg straight. Adductor work most people skip."),
      working("Single-leg Calf Raise", 15, undefined, 3, 45, "Per leg. Full stretch at the bottom, pause at the top."),
      stretch("Kneeling Hip Flexor Stretch", 1, 0),
    ],
  },
  {
    name: "Home · Arms — Pump Session",
    focus: "Arms · Home",
    category: "Full",
    notes:
      "20 minutes, supersets throughout, chase blood into the muscle. Light weight done strictly beats heavy weight thrown around.",
    sets: [
      ss("A", "Dumbbell Hammer Curl", 12, 3, 30, "Strict."),
      ss("A", "Dumbbell Overhead Tricep Extension", 12, 3, 60, "Superset. Elbows narrow, full stretch."),
      ss("B", "Dumbbell Incline Curl", 12, 3, 30, "Lie back — this puts the bicep in a stretched position from rep one."),
      ss("B", "Band Rope Pushdown", 15, 3, 60, "Squeeze the lockout."),
      ss("C", "Dumbbell Spider Curl", 15, 3, 30, "Chest on an incline, arms hanging. Peak contraction."),
      ss("C", "Dumbbell Tate Press", 15, 3, 45, "Finisher."),
      working("Dumbbell Zottman Curl", 15, undefined, 2, 45, "Up normal, down reverse. Forearms get the message."),
    ],
  },
  {
    name: "Home · Full Body — Density 30",
    focus: "Full Body · Home",
    category: "Full",
    notes:
      "Three supersets, 30 minutes, everything trained. The default when the day got away from you.",
    sets: [
      [{ name: "Jump Rope", reps: 3, setType: "Warm-up", workSeconds: 180, rest: 0 }],
      pt("Band External Rotation", 12, 2, 20),
      ss("A", "Kettlebell Goblet Squat", 12, 3, 30, "Deep, tall chest."),
      ss("A", "Dumbbell Single-arm Row", 12, 3, 75, "Superset."),
      ss("B", "Dumbbell Floor Press", 12, 3, 30, "Pause on the floor."),
      ss("B", "Dumbbell Romanian Deadlift", 12, 3, 75, "Superset."),
      ss("C", "Kettlebell Swings", 15, 3, 30, "Hip snap."),
      ss("C", "Dead Bug", 12, 3, 45, "Low back pinned."),
      stretch("Child's Pose", 1, 0),
    ],
  },
  {
    name: "Home · Core — Brace",
    focus: "Core · Home",
    category: "Full",
    notes:
      "Anti-movement first (resisting rotation and extension), then flexion work. Builds a trunk that protects your back rather than just abs that look good.",
    sets: [
      working("Band Pallof Press", 12, undefined, 3, 45, "Per side. Resist the twist — that's the entire exercise."),
      working("Dead Bug", 12, undefined, 3, 45, "Low back glued down."),
      working("Hollow Hold", 30, undefined, 3, 45, "Ribs down, low back flat. Shorten the lever if it lifts."),
      ss("A", "Hanging Leg Raise", 12, 3, 30, "Control the descent — no swinging."),
      ss("A", "Side Plank (Left)", 30, 3, 30, "Stack the hips."),
      working("Side Plank (Right)", 30, undefined, 3, 45),
      stretch("Child's Pose", 1, 0),
    ],
  },

  // ---------- Home strength — short options for non-gym days ----------
  {
    name: "Home · Quick Upper 20",
    focus: "Upper Body · Home",
    category: "Full",
    notes: "Dumbbells and bands only. In and out in twenty.",
    sets: [
      pt("Band External Rotation", 12, 2, 20),
      working("Dumbbell Floor Press", 12, undefined, 3, 60),
      working("Dumbbell Single-arm Row", 12, undefined, 3, 60),
      working("Dumbbell Hammer Curl", 12, undefined, 2, 45),
      working("Band Rope Pushdown", 15, undefined, 2, 45),
    ],
  },
  {
    name: "Home · Quick Lower 20",
    focus: "Lower Body · Home",
    category: "Full",
    notes: "No barbell needed. Slow eccentrics, full depth.",
    sets: [
      [{ name: "Jump Rope", reps: 3, setType: "Warm-up", workSeconds: 180, rest: 0 }],
      working("Kettlebell Goblet Squat", 12, undefined, 3, 60),
      working("Bulgarian Split Squat", 10, undefined, 3, 60),
      working("Dumbbell Romanian Deadlift", 12, undefined, 3, 60),
      working("Single-leg Calf Raise", 15, undefined, 2, 45),
    ],
  },
  {
    name: "Home · Core 15",
    focus: "Core · Home",
    category: "Full",
    sets: [
      working("Dead Bug", 12, undefined, 3, 45),
      working("Forearm Plank", 40, undefined, 3, 45),
      working("Sit-up", 20, undefined, 3, 45),
      working("Band Pallof Press", 12, undefined, 2, 45),
      stretch("Child's Pose", 1),
    ],
  },
  {
    name: "Home · Full Body 30",
    focus: "Full Body · Home",
    category: "Full",
    sets: [
      pt("Band External Rotation", 12, 2, 20),
      working("Kettlebell Goblet Squat", 12, undefined, 3, 60),
      working("Dumbbell Floor Press", 12, undefined, 3, 60),
      working("Dumbbell Single-arm Row", 12, undefined, 3, 60),
      working("Kettlebell Swings", 15, undefined, 3, 60),
      working("Dead Bug", 12, undefined, 2, 45),
    ],
  },
  {
    name: "Home · Kettlebell 25",
    focus: "Full Body · Home",
    category: "Full",
    sets: [
      [{ name: "Jump Rope", reps: 3, setType: "Warm-up", workSeconds: 180, rest: 0 }],
      working("Kettlebell Swings", 15, undefined, 4, 60),
      working("Kettlebell Goblet Squat", 12, undefined, 3, 60),
      working("Kettlebell Single-arm Row", 12, undefined, 3, 60),
      working("Kettlebell Halo", 10, undefined, 2, 45),
    ],
  },

  // ---------- Gym — short options ----------
  {
    name: "Gym · Express Upper 25",
    focus: "Upper Body · Gym",
    category: "Full",
    notes: "Tight on time. Three big lifts, warm the cuff, go.",
    sets: [
      [{ name: "Stationary Bike", reps: 5, setType: "Warm-up", workSeconds: 300, rest: 0 }],
      pt("Band External Rotation", 12, 2, 20),
      working("Machine Chest Press", 10, undefined, 3, 75),
      working("Close-Grip Lat Pulldown (neutral)", 10, undefined, 3, 75),
      working("Cable Lateral Raise", 12, undefined, 2, 60),
    ],
  },
  {
    name: "Gym · Express Lower 25",
    focus: "Lower Body · Gym",
    category: "Full",
    sets: [
      [{ name: "Stair Climber (StairMaster)", reps: 5, setType: "Warm-up", workSeconds: 300, rest: 0 }],
      working("Hack Squat (Machine)", 10, undefined, 3, 90),
      working("Seated Leg Curl (Machine)", 12, undefined, 3, 60),
      working("Standing Calf Raise (Machine)", 15, undefined, 3, 45),
    ],
  },

  // ---------- AMRAP / conditioning — score is rounds, tracked over time ----------
  {
    name: "AMRAP · Alt Cindy",
    focus: "Conditioning · 20 min AMRAP",
    category: "Full",
    format: "amrap",
    capMinutes: 20,
    notes:
      "As many rounds as possible in 20 minutes. One round = 12 skullcrushers, 15 air squats, 20 sit-ups, 15 hammer curls. Score is rounds completed — beat it next time.",
    sets: [
      round("Dumbbell Floor Skull Crusher", 12),
      round("Bodyweight Squat", 15),
      round("Sit-up", 20),
      round("Dumbbell Hammer Curl", 15),
    ],
  },
  {
    name: "AMRAP · Alt Cindy (Short)",
    focus: "Conditioning · 12 min AMRAP",
    category: "Full",
    format: "amrap",
    capMinutes: 12,
    notes: "Same round as Alt Cindy, shorter cap. Good on a tight day.",
    sets: [
      round("Dumbbell Floor Skull Crusher", 12),
      round("Bodyweight Squat", 15),
      round("Sit-up", 20),
      round("Dumbbell Hammer Curl", 15),
    ],
  },
  {
    name: "AMRAP · Core + Squat 10",
    focus: "Conditioning · 10 min AMRAP",
    category: "Full",
    format: "amrap",
    capMinutes: 10,
    notes: "Quick engine work. One round = 15 air squats, 15 sit-ups, 20 mountain climbers.",
    sets: [
      round("Bodyweight Squat", 15),
      round("Sit-up", 15),
      round("Mountain Climber", 20),
    ],
  },
  {
    name: "AMRAP · Kettlebell 15",
    focus: "Conditioning · 15 min AMRAP",
    category: "Full",
    format: "amrap",
    capMinutes: 15,
    notes: "One round = 15 KB swings, 12 goblet squats, 10 single-arm rows per side.",
    sets: [
      round("Kettlebell Swings", 15),
      round("Kettlebell Goblet Squat", 12),
      round("Kettlebell Single-arm Row", 10),
    ],
  },

  // ---------- Named benchmarks ----------
  // The CrossFit "girls" idea: a handful of fixed, named rounds you repeat for
  // months so the score means something. Rules they all follow:
  //   - Equipment-light (bodyweight, one kettlebell, one dumbbell, a band) so
  //     the score is comparable at home, in a hotel, or at the gym. A benchmark
  //     you can only run in one place stops being a benchmark.
  //   - Shoulder-safe: no push-ups, no overhead pressing, no wide-grip pulling.
  //   - One round lands around 60–90s, so rounds accumulate into a real score
  //     rather than a number you could miscount by one and ruin.
  // Each targets a different quality, so picking one is a real choice.
  {
    name: "AMRAP · Ify",
    focus: "Benchmark · 20 min AMRAP",
    category: "Full",
    format: "amrap",
    capMinutes: 20,
    notes:
      "The big one. One round = 10 kettlebell swings, 12 goblet squats, 15 sit-ups. Full-body engine — hinge, squat, brace. Pace it: 20 minutes is long, and going out hot costs you more rounds than it buys.",
    sets: [
      round("Kettlebell Swings", 10, undefined, "Hips snap, arms are rope."),
      round("Kettlebell Goblet Squat", 12, undefined, "Elbows inside knees, chest tall."),
      round("Sit-up", 15),
    ],
  },
  {
    name: "AMRAP · Billy",
    focus: "Benchmark · 15 min AMRAP · legs",
    category: "Full",
    format: "amrap",
    capMinutes: 15,
    notes:
      "Legs. One round = 20 air squats, 10 box step-ups per side, 10 walking lunges per side. Purely lower body, so it pairs well the day after an upper session.",
    sets: [
      round("Bodyweight Squat", 20, undefined, "Full depth, no bouncing out of the bottom."),
      round("Box Step-up", 10, undefined, "10 each side. Drive through the heel."),
      round("Dumbbell Walking Lunge", 10, undefined, "10 each side. Light dumbbells."),
    ],
  },
  {
    name: "AMRAP · Sally",
    focus: "Benchmark · 12 min AMRAP · core",
    category: "Full",
    format: "amrap",
    capMinutes: 12,
    notes:
      "Core only. One round = 15 sit-ups, 20 Russian twists, 10 dead bugs per side, 20 mountain climbers. Short cap because trunk work fatigues fast and sloppy reps aren't worth scoring.",
    sets: [
      round("Sit-up", 15),
      round("Russian Twist", 20, undefined, "20 total, 10 each way."),
      round("Dead Bug", 10, undefined, "10 each side. Ribs down, low back flat."),
      round("Mountain Climber", 20, undefined, "20 total. Hips stay level."),
    ],
  },
  {
    name: "AMRAP · Jessie",
    focus: "Benchmark · 15 min AMRAP · pull & arms",
    category: "Full",
    format: "amrap",
    capMinutes: 15,
    notes:
      "Upper body without a single press. One round = 10 single-arm rows per side, 12 hammer curls, 15 band pushdowns. Shoulder-safe by construction — all pulling and elbow work, nothing overhead.",
    sets: [
      round("Kettlebell Single-arm Row", 10, undefined, "10 each side. Pull to the hip, not the armpit."),
      round("Dumbbell Hammer Curl", 12),
      round("Band Tricep Pushdown", 15, undefined, "Elbows pinned to your sides."),
    ],
  },
  {
    name: "AMRAP · Vicky",
    focus: "Benchmark · 10 min AMRAP · sprint",
    category: "Full",
    format: "amrap",
    capMinutes: 10,
    notes:
      "Short and nasty. One round = 8 burpees, 12 air squats, 20 mountain climbers. Ten minutes, no equipment — this is the one for a day you nearly skipped.",
    sets: [
      round("Burpee (no push-up)", 8, undefined, "Step back if the shoulder objects. No push-up at the bottom."),
      round("Bodyweight Squat", 12),
      round("Mountain Climber", 20, undefined, "20 total."),
    ],
  },

  // ---------- Short mobility flows ----------
  // Run as guided timers ("flow" format), so the holds are paced for you.
  // Every routine's holds sum EXACTLY to its cap — 10 x 30s for the 5-minute
  // ones, 10 x 60s for the 10-minute ones. That's deliberate: the name, the
  // duration in the Library, and the clock in the session all have to agree,
  // or you stop trusting any of them.
  {
    name: "Stretch · 5 min Wake-up",
    focus: "Mobility · 5 min",
    category: "PT Only",
    format: "flow",
    capMinutes: 5,
    notes: "Ten holds, 30 seconds each. Spine first, then the front line, then legs.",
    sets: [
      hold("Cat-Cow Pose", 30, "Move with the breath, don't force either end."),
      hold("Bhujangasana — Cobra Abdominal Stretch", 30, "Hips stay down."),
      hold("Balasana — Child Pose", 30),
      hold("Thread the Needle", 30, "15 seconds each side."),
      hold("Foam Roller Thoracic Extension", 30, "Roller under the mid-back."),
      hold("Doorway Chest Stretch", 30, "Elbow at shoulder height, never above."),
      hold("Cross-Body Shoulder Stretch", 30, "15 each side."),
      hold("Standing Quad Stretch", 30, "15 each side. Squeeze the glute."),
      hold("Standing Hamstring Stretch", 30, "15 each side. Soft knee."),
      hold("Calf Stretch at Wall", 30, "15 each side."),
    ],
  },
  {
    name: "Stretch · 5 min Shoulders",
    focus: "Mobility · 5 min · upper body",
    category: "PT Only",
    format: "flow",
    capMinutes: 5,
    notes:
      "Shoulder and t-spine only. Gentle range throughout — this is circulation, not a test of tolerance.",
    sets: [
      hold("Foam Roller Thoracic Extension", 30, "Roller under the mid-back, support your head."),
      hold("Cat-Cow Pose", 30),
      hold("Thread the Needle", 30, "15 each side."),
      hold("Cross-Body Shoulder Stretch", 30, "15 each side."),
      hold("Doorway Chest Stretch", 30, "Elbow at shoulder height."),
      hold("Overhead Tricep Stretch", 30, "15 each side. Only as far as comfortable."),
      hold("Banded Sleeper Stretch (gentle)", 30, "Very light. Stop at the first pinch."),
      hold("Foam Roller Back Stretch", 30),
      hold("Seal Stretch", 30, "Hips heavy, no crunching."),
      hold("Balasana — Child Pose", 30, "Arms long, breathe into the upper back."),
    ],
  },
  {
    name: "Stretch · 5 min Hips",
    focus: "Mobility · 5 min · hips",
    category: "PT Only",
    format: "flow",
    capMinutes: 5,
    notes: "For days spent sitting. Ten holds, 30 seconds each.",
    sets: [
      hold("Figure Four Glute Stretch", 30, "15 each side."),
      hold("Kneeling Hip Flexor Stretch", 30, "15 each side. Back glute squeezed."),
      hold("90/90 Hip Stretch", 30, "15 each side."),
      hold("Ardha Kapotasana - Half Pigeon Pose", 30, "15 each side."),
      hold("Frog Stretch", 30, "Rock back slowly, stop before it pinches."),
      hold("Titli Asana — Butterfly Pose", 30),
      hold("Couch Stretch", 30, "15 each side. Back off if the knee complains."),
      hold("Standing Hamstring Stretch", 30, "15 each side."),
      hold("Malasana — Squat Pose or Garland Pose", 30, "Sit in the bottom, elbows inside knees."),
      hold("Balasana — Child Pose", 30),
    ],
  },
  {
    name: "Stretch · 10 min Full Body",
    focus: "Mobility · 10 min",
    category: "PT Only",
    format: "flow",
    capMinutes: 10,
    notes: "Top to bottom. Ten holds at a full minute each — long enough that tissue actually changes.",
    sets: [
      hold("Cat-Cow Pose", 60),
      hold("Bhujangasana — Cobra Abdominal Stretch", 60, "Five slow press-ups, then hold."),
      hold("Thread the Needle", 60, "30 each side."),
      hold("Foam Roller Thoracic Extension", 60, "Work up and down the mid-back."),
      hold("Doorway Chest Stretch", 60, "30 each side, elbow at shoulder height."),
      hold("Figure Four Glute Stretch", 60, "30 each side."),
      hold("Kneeling Hip Flexor Stretch", 60, "30 each side."),
      hold("Standing Hamstring Stretch", 60, "30 each side."),
      hold("Calf Stretch at Wall", 60, "Straight knee, then bent — different muscles."),
      hold("Balasana — Child Pose", 60, "Finish here. Slow the breathing down."),
    ],
  },
  {
    name: "Stretch · 10 min Lower Body",
    focus: "Mobility · 10 min · legs & hips",
    category: "PT Only",
    format: "flow",
    capMinutes: 10,
    notes: "The one for the day after legs. Roll first, then hold.",
    sets: [
      hold("Foam Roller Glutes", 60, "30 each side. Pause on the sore spots."),
      hold("Foam Roller Calves", 60, "30 each side."),
      hold("Figure Four Glute Stretch", 60, "30 each side."),
      hold("90/90 Hip Stretch", 60, "30 each side."),
      hold("Ardha Kapotasana - Half Pigeon Pose", 60, "30 each side."),
      hold("Couch Stretch", 60, "30 each side. Brutal — back off if the knee complains."),
      hold("Kneeling Hip Flexor Stretch", 60, "30 each side."),
      hold("Standing Hamstring Stretch", 60, "30 each side."),
      hold("Calf Stretch at Wall", 60, "30 each side."),
      hold("Malasana — Squat Pose or Garland Pose", 60, "Sit in the bottom and breathe."),
    ],
  },
  {
    name: "Stretch · 10 min Desk Reset",
    focus: "Mobility · 10 min · posture",
    category: "PT Only",
    format: "flow",
    capMinutes: 10,
    notes:
      "Undoes a day at a screen — t-spine extension, chest opening, hip flexors. Good in the evening.",
    sets: [
      hold("Foam Roller Thoracic Extension", 60, "Work up and down the mid-back."),
      hold("Cat-Cow Pose", 60),
      hold("Thread the Needle", 60, "30 each side."),
      hold("Doorway Chest Stretch", 60, "30 each side."),
      hold("Cross-Body Shoulder Stretch", 60, "30 each side."),
      hold("Overhead Tricep Stretch", 60, "30 each side."),
      hold("Seal Stretch", 60, "Gentle — hips stay heavy."),
      hold("Kneeling Hip Flexor Stretch", 60, "30 each side. This is the one that matters."),
      hold("Figure Four Glute Stretch", 60, "30 each side."),
      hold("Balasana — Child Pose", 60),
    ],
  },
];

/**
 * Templates that shipped in earlier versions and have since been replaced by
 * better-programmed ones. They're already sitting in users' Firestore
 * libraries, so the Library "Manage" section offers to delete them by name.
 *
 * Only ever add names here — never rename an entry, or the cleanup will miss
 * the copy the user actually has.
 */
export const RETIRED_TEMPLATE_NAMES: string[] = [
  // Superseded by the "Gym · <Split> — <Name>" hypertrophy sessions
  "Full · Lower Strength A",
  "Full · Lower Strength B",
  "Full · Upper Press",
  "Full · Upper Pull",
  "Full · Core + Carry",
  "Full · Kettlebell Day",
  "Full · Band Circuit",
  "Full · Legs + Arms Superset",
  "Full · Glute-Dominant",
  "Full · Core-Dominant",
  "Full · Short + Sweet 30",
  "Full · Long Cardio + PT",
  "Gym · Leg Day",
  "Gym · Lower Posterior",
  "Gym · Upper Push",
  "Gym · Upper Pull",
  "Gym · Full Body",
  "Gym · Quad Focus",
  "Gym · Glutes + Hamstrings",
  "Gym · Chest + Triceps",
  "Gym · Back + Biceps",
  "Gym · Shoulders + Arms",
  "Gym · Push Day",
  "Gym · Pull Day",
  "Gym · Core + Conditioning",
  // Superseded by the research-backed AM/PM routines
  "PT · Pulleys + Bands",
  "PT · Mobility Flow",
  "PT · External Rotation Focus",
  "PT · Scapular Stability",
  "PT · Quick 15",
  "PT · Morning Primer",
  "PT · Morning Stretch Flow",
  "PT · Hip + Low Back Stretch",
  "PT · Upper Body Mobility",
  "PT · Yoga Flow",
  "PT · Post-Run Cooldown",
  "PT · Evening Wind-Down",
  "PT · Core Activation",
  "PT · Pre-Lift Shoulder Prep",
];

/** Which of the user's templates are retired versions. */
export function findRetiredTemplates<T extends { id: string; name: string }>(
  templates: T[]
): T[] {
  const retired = new Set(RETIRED_TEMPLATE_NAMES.map((n) => n.toLowerCase()));
  return templates.filter((t) => retired.has(t.name.toLowerCase()));
}

/** How many starter templates aren't in the user's library yet (by name).
 *  Drives the "new starter workouts available" banner in Library. */
export function countMissingStarterTemplates(existingNames: string[]): number {
  const have = new Set(existingNames.map((n) => n.toLowerCase()));
  return STARTER_TEMPLATES.filter((t) => !have.has(t.name.toLowerCase())).length;
}

/**
 * Resolve seed specs against the user's live exercise catalog (name-matched,
 * case-insensitive, non-alphanumerics collapsed to spaces). Missing exercises
 * are silently skipped; the caller logs what landed.
 */
export function resolveStarterTemplates(
  exerciseCatalog: { id: string; name: string }[]
): Array<{
  name: string;
  focus: string;
  category: TemplateCategory;
  notes?: string;
  format?: WorkoutFormat;
  capMinutes?: number;
  plannedSets: PlannedSet[];
  missing: string[];
}> {
  const byNorm = new Map<string, { id: string; name: string }>();
  for (const ex of exerciseCatalog) {
    byNorm.set(normalize(ex.name), ex);
  }

  return STARTER_TEMPLATES.map((t) => {
    // Flatten blocks; each block = array of SeedSet for ONE exercise (or a
    // superset across exercises sharing supersetKey).
    const flat: SeedSet[] = t.sets.flat();
    const plannedSets: PlannedSet[] = [];
    const missing: string[] = [];
    const gidByKey = new Map<string, string>();

    let order = 1;
    for (const s of flat) {
      const match = byNorm.get(normalize(s.name));
      if (!match) {
        missing.push(s.name);
        continue;
      }
      let gid: string | undefined;
      if (s.supersetKey) {
        if (!gidByKey.has(s.supersetKey)) {
          gidByKey.set(
            s.supersetKey,
            `ss_${crypto.randomUUID().slice(0, 8)}`
          );
        }
        gid = gidByKey.get(s.supersetKey);
      }
      plannedSets.push({
        id: crypto.randomUUID(),
        exerciseId: match.id,
        exerciseName: match.name,
        order: order++,
        supersetGroupId: gid,
        targetReps: s.reps,
        targetWeight: s.weight,
        setType: s.setType ?? "Working",
        restSeconds: s.rest,
        workSeconds: s.workSeconds,
        notes: s.cue,
        completedAt: null,
      });
    }

    return {
      name: t.name,
      focus: t.focus,
      category: t.category,
      notes: t.notes,
      format: t.format,
      capMinutes: t.capMinutes,
      plannedSets,
      missing,
    };
  });
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
