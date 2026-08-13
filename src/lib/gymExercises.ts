// Commercial-gym catalog — barbell, machine, cable, and cardio-equipment work
// for full gym sessions (leg-day staples first: stair climber, trap bar
// deadlift, hack squat, goblet squat, Bulgarian split squats live in the home
// catalog already). Merged into the importable CATALOG in db.ts alongside the
// Notion + home sets; dedupeByName keeps overlapping names single.

import type { Exercise } from "./types";

type SeedExercise = Omit<Exercise, "id" | "createdAt" | "updatedAt">;

export const GYM_EXERCISES: SeedExercise[] = [
  // --- Leg-day staples (user's gym program) ---
  { name: 'Stair Climber (StairMaster)', category: 'Cardio', equipment: ['StairMaster'], muscleGroups: ['Quads', 'Glutes', 'Calves'], isPT: false, isBannedLatarjet: false, notes: 'Warm-up pace: 15–20 min steady.' },
  { name: 'Trap Bar Deadlift', category: 'Lower Body', equipment: ['Trap bar'], muscleGroups: ['Glutes', 'Hamstrings', 'Quads', 'Traps'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Hack Squat (Machine)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Goblet Squat', category: 'Lower Body', equipment: ['Kettlebell'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },

  // --- Lower body: barbell ---
  { name: 'Barbell Back Squat', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Barbell Front Squat', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Quads', 'Core'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Barbell Deadlift', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Glutes', 'Hamstrings', 'Back'], isPT: false, isBannedLatarjet: false, defaultReps: 6 },
  { name: 'Barbell Sumo Deadlift', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Glutes', 'Adductors', 'Hamstrings'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Barbell Romanian Deadlift', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Hamstrings', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Barbell Good Morning', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Hamstrings', 'Lower Back'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Barbell Walking Lunge', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Smith Machine Squat', category: 'Lower Body', equipment: ['Smith machine'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },

  // --- Lower body: machines ---
  { name: 'Leg Press', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Leg Extension (Machine)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Quads'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Lying Leg Curl (Machine)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Hamstrings'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Seated Leg Curl (Machine)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Hamstrings'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Hip Abduction Machine', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Glutes', 'Abductors'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Hip Adduction Machine', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Adductors'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Glute Kickback Machine', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Standing Calf Raise (Machine)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Calves'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Seated Calf Raise (Machine)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Calves'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Leg Press Calf Raise', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Calves'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Back Extension (45°)', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Lower Back', 'Glutes', 'Hamstrings'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Sled Push', category: 'Full Body', equipment: ['Sled'], muscleGroups: ['Quads', 'Glutes', 'Calves'], isPT: false, isBannedLatarjet: false },
  { name: 'Sled Pull (Harness Drag)', category: 'Full Body', equipment: ['Sled', 'Harness'], muscleGroups: ['Quads', 'Glutes', 'Calves'], isPT: false, isBannedLatarjet: false, notes: 'Drive from the legs — let the harness do the pulling, not the shoulders.' },
  { name: 'Sled Row', category: 'Full Body', equipment: ['Sled', 'Rope'], muscleGroups: ['Lats', 'Rhomboids', 'Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10, notes: 'Rope pull toward the chest. Keep elbows in — no wide, high pulling.' },
  { name: 'Sled Backward Drag', category: 'Full Body', equipment: ['Sled', 'Straps'], muscleGroups: ['Quads', 'Calves'], isPT: false, isBannedLatarjet: false, notes: 'Walking backwards — brutal on the quads, easy on the joints.' },
  { name: 'Sledgehammer Swings', category: 'Full Body', equipment: ['Sledgehammer', 'Tire'], muscleGroups: ['Core', 'Shoulders', 'Back'], isPT: false, isBannedLatarjet: false, defaultReps: 10, notes: 'Overhead swinging — only once the shoulder is fully warm and cleared.' },

  // --- Upper push ---
  { name: 'Barbell Bench Press', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Incline Barbell Bench Press', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Chest', 'Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Incline Dumbbell Bench Press', category: 'Upper Body', equipment: ['Dumbbell'], muscleGroups: ['Chest', 'Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Close-Grip Bench Press', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Triceps', 'Chest'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Machine Chest Press', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Machine Shoulder Press (neutral grip)', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Shoulders', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Cable Crossover', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Chest'], isPT: false, isBannedLatarjet: false, defaultReps: 12, notes: 'Keep the stretch shallow if the shoulder complains.' },
  { name: 'Pec Deck Fly', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Chest'], isPT: false, isBannedLatarjet: false, defaultReps: 12, notes: 'Partial range — avoid a deep stretch on the repaired side.' },
  { name: 'Cable Lateral Raise', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Dip (Parallel Bars)', category: 'Upper Body', equipment: ['Dip bars'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Assisted Dip Machine', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },

  // --- Upper pull ---
  { name: 'Lat Pulldown', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Lats', 'Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Close-Grip Lat Pulldown (neutral)', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Lats', 'Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Seated Cable Row', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Lats', 'Rhomboids'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Bent-Over Barbell Row', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Lats', 'Rhomboids'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'T-Bar Row', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Lats', 'Rhomboids'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Chest-Supported Machine Row', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Lats', 'Rhomboids'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Assisted Pull-up Machine', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Lats', 'Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 8, notes: 'Narrow or neutral grip — skip wide grip post-Latarjet.' },
  { name: 'Cable Face Pull', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Rear Delts', 'Rotator Cuff'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Cable Straight-Arm Pulldown', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Lats'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Machine Rear Delt Fly', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Rear Delts'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Barbell Shrug', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Traps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },

  // --- Arms ---
  { name: 'Barbell Curl', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'EZ-Bar Curl', category: 'Upper Body', equipment: ['EZ bar'], muscleGroups: ['Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Cable Curl', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Preacher Curl (Machine)', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Cable Rope Hammer Curl', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Biceps', 'Forearms'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Cable Rope Pushdown', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'EZ-Bar Skull Crusher', category: 'Upper Body', equipment: ['EZ bar'], muscleGroups: ['Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },

  // --- Core ---
  { name: 'Cable Crunch', category: 'Core', equipment: ['Cable'], muscleGroups: ['Abs'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Ab Crunch Machine', category: 'Core', equipment: ['Machine'], muscleGroups: ['Abs'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Hanging Leg Raise', category: 'Core', equipment: ['Pull-up bar'], muscleGroups: ['Abs', 'Hip Flexors'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Cable Woodchopper', category: 'Core', equipment: ['Cable'], muscleGroups: ['Obliques'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },

  // --- Added for expanded gym programming ---
  { name: 'Rack Pull', category: 'Lower Body', equipment: ['Barbell', 'Rack'], muscleGroups: ['Back', 'Glutes', 'Hamstrings'], isPT: false, isBannedLatarjet: false, defaultReps: 6 },
  { name: 'Reverse Hyperextension', category: 'Lower Body', equipment: ['Machine'], muscleGroups: ['Glutes', 'Hamstrings', 'Lower Back'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Sissy Squat', category: 'Lower Body', equipment: [], muscleGroups: ['Quads'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Step-up with Knee Raise', category: 'Lower Body', equipment: ['Box'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Front Box Jump', category: 'Lower Body', equipment: ['Box'], muscleGroups: ['Quads', 'Glutes'], isPT: false, isBannedLatarjet: false, defaultReps: 5 },
  { name: 'Barbell Overhead Press', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Shoulders', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 8, notes: 'Warm the rotator cuff thoroughly first — overhead pressing needs prep.' },
  { name: 'Decline Barbell Bench Press', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 8 },
  { name: 'Incline Cable Chest Press', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Chest', 'Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Incline Cable Fly', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Chest'], isPT: false, isBannedLatarjet: false, defaultReps: 12, notes: 'Keep the stretch shallow on the repaired side.' },
  { name: 'Front Plate Raise', category: 'Upper Body', equipment: ['Plate'], muscleGroups: ['Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Seated Lateral Raise', category: 'Upper Body', equipment: ['Dumbbell'], muscleGroups: ['Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Reverse Pec Deck', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Rear Delts'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Cable Shrug', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Traps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Weighted Pull-up', category: 'Upper Body', equipment: ['Pull-up bar'], muscleGroups: ['Lats', 'Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 6, notes: 'Neutral or supinated grip only — wide grip is banned post-Latarjet.' },
  { name: 'Triceps Pushdown (V-Bar)', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Machine Bicep Curl', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Decline Crunch', category: 'Core', equipment: ['Bench'], muscleGroups: ['Abs'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Cable Russian Twist', category: 'Core', equipment: ['Cable'], muscleGroups: ['Obliques'], isPT: false, isBannedLatarjet: false, defaultReps: 12, notes: 'Rotate from the hips, keep the shoulder out of it.' },
  { name: "Farmer's Walk", category: 'Full Body', equipment: ['Dumbbell'], muscleGroups: ['Traps', 'Core', 'Forearms'], isPT: false, isBannedLatarjet: false },
  { name: 'Smith Machine Bench Press', category: 'Upper Body', equipment: ['Smith machine'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Smith Machine Bent-Over Row', category: 'Upper Body', equipment: ['Smith machine'], muscleGroups: ['Lats', 'Rhomboids'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Smith Machine Calf Raise', category: 'Lower Body', equipment: ['Smith machine'], muscleGroups: ['Calves'], isPT: false, isBannedLatarjet: false, defaultReps: 15 },
  { name: 'Machine Bench Press', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Chest', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 10 },
  { name: 'Standing Military Press', category: 'Upper Body', equipment: ['Barbell'], muscleGroups: ['Shoulders', 'Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 8, notes: 'Front rack only — never behind the neck.' },
  { name: 'Landmine 180', category: 'Core', equipment: ['Barbell', 'Landmine'], muscleGroups: ['Obliques', 'Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 10, notes: 'Control the arc — no fast rotation under load on the repaired side.' },
  { name: 'Cable Seated Lateral Raise', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Shoulders'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Dumbbell Incline Row', category: 'Upper Body', equipment: ['Dumbbell', 'Bench'], muscleGroups: ['Lats', 'Rhomboids'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Cable Deadlift', category: 'Lower Body', equipment: ['Cable'], muscleGroups: ['Glutes', 'Hamstrings'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Clean Deadlift', category: 'Lower Body', equipment: ['Barbell'], muscleGroups: ['Glutes', 'Hamstrings', 'Back'], isPT: false, isBannedLatarjet: false, defaultReps: 6 },
  { name: 'Machine Preacher Curl', category: 'Upper Body', equipment: ['Machine'], muscleGroups: ['Biceps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },
  { name: 'Cable Incline Pushdown', category: 'Upper Body', equipment: ['Cable'], muscleGroups: ['Triceps'], isPT: false, isBannedLatarjet: false, defaultReps: 12 },

  // --- Cardio machines ---
  { name: 'Treadmill Incline Walk', category: 'Cardio', equipment: ['Treadmill'], muscleGroups: ['Legs'], isPT: false, isBannedLatarjet: false },
  { name: 'Rowing Machine (Erg)', category: 'Cardio', equipment: ['Rower'], muscleGroups: ['Back', 'Legs'], isPT: false, isBannedLatarjet: false },
  { name: 'Elliptical', category: 'Cardio', equipment: ['Elliptical'], muscleGroups: ['Legs'], isPT: false, isBannedLatarjet: false },
  { name: 'Assault Bike', category: 'Cardio', equipment: ['Bike'], muscleGroups: ['Legs', 'Full Body'], isPT: false, isBannedLatarjet: false },
  { name: 'Stationary Bike', category: 'Cardio', equipment: ['Bike'], muscleGroups: ['Legs'], isPT: false, isBannedLatarjet: false },
];
