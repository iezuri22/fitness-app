/**
 * Reference material for the body-part study pages.
 *
 * Written for this user specifically: a lifter training around a repaired
 * shoulder (Latarjet). Where a body part carries real risk for that shoulder,
 * `caution` says so in plain terms rather than leaving it to be inferred from
 * a banned-exercise flag.
 *
 * Kept as data, not prose in a component, so the same content can feed the
 * detail page, search, and anything later that wants to explain a muscle.
 */
import type { BodyPart } from "./generateWorkout";

export interface BodyPartGuide {
  /** The muscles involved, in the order worth learning them. */
  muscles: { name: string; role: string }[];
  /** One paragraph: what this area actually does. */
  what: string;
  /** How to train it — patterns, volume, rep ranges. */
  how: string;
  /** Movement patterns that cover it. */
  patterns: string[];
  /** Things people get wrong. */
  mistakes: string[];
  /** Shoulder-safety note. Omitted where the area carries no real risk. */
  caution?: string;
}

export const BODY_PART_GUIDE: Record<BodyPart, BodyPartGuide> = {
  chest: {
    muscles: [
      { name: "Pectoralis major (sternal head)", role: "The bulk of the chest — brings the arm across the body" },
      { name: "Pectoralis major (clavicular head)", role: "Upper chest — presses upward and forward" },
      { name: "Pectoralis minor", role: "Sits underneath; pulls the shoulder blade down and forward" },
    ],
    what:
      "The chest's job is horizontal adduction — pulling your upper arm across the front of your body — plus shoulder flexion and internal rotation. Anything you push away from your torso, or hug inward, is chest work.",
    how:
      "Two families cover it: presses (flat, incline, machine) and flyes or crossovers. Presses build most of the size because you can load them heavily; flyes add the stretched position that presses don't reach. Around 10–20 hard sets a week, 6–12 reps on presses and 10–15 on flyes. Incline work biases the upper chest, which is the part most people under-train.",
    patterns: ["Horizontal press", "Incline press", "Fly / crossover"],
    mistakes: [
      "Flaring the elbows straight out to 90° — hard on the shoulder and no better for the chest",
      "Bouncing the bar off the ribs instead of controlling the descent",
      "Stopping halfway down, which skips the stretched position that drives most of the growth",
      "Training only flat pressing and wondering why the upper chest lags",
    ],
    caution:
      "This is the highest-risk area for your shoulder. Deep flyes and wide-grip benching put the joint into maximum external rotation and horizontal abduction — the exact position an anterior dislocation happens in. Keep elbows tucked to roughly 45°, don't let the hands travel behind the line of the chest, and treat a stretch you can feel in the front of the shoulder as a stop signal.",
  },

  back: {
    muscles: [
      { name: "Latissimus dorsi", role: "The wide one — pulls the arm down and back toward the hip" },
      { name: "Trapezius (upper, mid, lower)", role: "Rotates, elevates and depresses the shoulder blade" },
      { name: "Rhomboids", role: "Squeezes the shoulder blades together" },
      { name: "Erector spinae", role: "Runs the length of the spine and resists it rounding" },
    ],
    what:
      "Back work is everything you pull toward you. The lats handle pulling the arm down or back; the traps and rhomboids control the shoulder blade itself. That second job matters more than it sounds — a shoulder blade that doesn't move properly is the root of most shoulder pain.",
    how:
      "Split it between vertical pulls (pulldowns, pull-ups) and horizontal pulls (rows). Back tolerates volume well: 12–20 sets a week is reasonable, 8–15 reps. Start each rep by moving the shoulder blade, then bend the elbow — if the elbow leads, your arms do the work.",
    patterns: ["Vertical pull", "Horizontal row", "Scapular retraction", "Deadlift / hinge"],
    mistakes: [
      "Letting the biceps take over — think about driving the elbow, not pulling with the hand",
      "No scapular movement at all, so the traps and rhomboids never get trained",
      "Heaving with the lower back on rows instead of keeping the torso still",
      "Skipping lower-trap work, which is what actually holds the shoulder blade down",
    ],
    caution:
      "Wide-grip pull-ups put the shoulder into abduction with external rotation, which is a vulnerable position for you. Neutral-grip or narrower pulls train the lats just as well with far less exposure.",
  },

  shoulders: {
    muscles: [
      { name: "Anterior deltoid", role: "Front — raises the arm forward, heavily involved in pressing" },
      { name: "Lateral deltoid", role: "Side — raises the arm out; the head of the shoulder's width" },
      { name: "Posterior deltoid", role: "Rear — pulls the arm backward, usually the weakest of the three" },
      { name: "Rotator cuff", role: "Four small muscles that hold the ball centred in the socket" },
    ],
    what:
      "The deltoid moves the arm; the rotator cuff keeps the joint together while it happens. They're different jobs and need different training. The shoulder is the most mobile joint in the body, and it buys that range by giving up stability — which is exactly why the cuff matters so much for you.",
    how:
      "Lateral raises for width, rear-delt work for balance and shoulder health, pressing for overall mass. 10–20 sets a week, mostly 10–20 reps — the delts respond better to volume than to heavy singles. Rotator cuff work is a separate category: light, high-rep, done as preparation rather than as training.",
    patterns: ["Overhead press", "Lateral raise", "Rear-delt fly", "External rotation"],
    mistakes: [
      "Pressing behind the neck — no upside, and the worst position the joint can be in",
      "Shrugging the traps up during lateral raises instead of leading with the elbow",
      "Ignoring the rear delts entirely, which pulls posture forward over time",
      "Treating cuff work as optional once the shoulder stops hurting",
    ],
    caution:
      "Never press from behind the neck, and never press overhead cold. Run your band external rotations and scapular work first — that's what the PT block at the start of your sessions is for. Overhead pressing is fine once warm, in front of the head, with a neutral or slightly angled grip.",
  },

  arms: {
    muscles: [
      { name: "Biceps brachii", role: "Bends the elbow and turns the palm up; crosses the shoulder too" },
      { name: "Brachialis", role: "Sits under the biceps — pure elbow flexor, adds thickness" },
      { name: "Triceps (long head)", role: "The biggest of the three; also extends the shoulder" },
      { name: "Triceps (lateral & medial heads)", role: "Straighten the elbow" },
    ],
    what:
      "Arms are elbow flexion and extension, nothing more complicated. The triceps are about two thirds of your upper arm, so if size is the goal they deserve at least equal billing with the biceps.",
    how:
      "8–15 reps, 8–15 sets a week each. They already get substantial indirect work from your pressing and pulling, so they need less direct volume than people assume. The long head of the triceps crosses the shoulder, so overhead extensions train it in a stretched position that pushdowns miss — same logic as incline work for the chest.",
    patterns: ["Elbow flexion (curl)", "Elbow extension (pushdown)", "Overhead extension"],
    mistakes: [
      "Swinging the weight up with the lower back instead of the elbow",
      "Letting the elbow drift forward on curls, which turns it into a front raise",
      "Training biceps hard and triceps as an afterthought",
      "Going too heavy to control the lowering half, which is where most of the work is",
    ],
  },

  legs: {
    muscles: [
      { name: "Quadriceps", role: "Four muscles on the front — straighten the knee" },
      { name: "Hamstrings", role: "Back of the thigh — bend the knee and extend the hip" },
      { name: "Adductors", role: "Inner thigh — pull the leg inward, and contribute in the squat" },
      { name: "Calves (gastrocnemius & soleus)", role: "Point the foot down; the soleus needs a bent knee" },
    ],
    what:
      "The lower body splits along one line: knee-dominant movements (squats, presses, extensions) train the quads, and hip-dominant ones (deadlifts, RDLs, curls) train the hamstrings and glutes. Most people do plenty of the first and not enough of the second.",
    how:
      "Cover both patterns every week, plus something single-legged for balance between sides. 10–20 sets a week per pattern. Quads take heavier loading and lower reps well; hamstrings respond to both heavy hinges and higher-rep curls. Calves need more reps and more frequency than feels reasonable — the soleus in particular only gets trained with a bent knee.",
    patterns: ["Squat", "Hinge / RDL", "Lunge / split squat", "Knee flexion", "Calf raise"],
    mistakes: [
      "Cutting depth — a quarter squat trains a quarter of the muscle",
      "Letting the knees collapse inward, usually a glute-medius weakness rather than a knee problem",
      "Squatting all year and never hinging, so the hamstrings never catch up",
      "Only doing straight-knee calf raises, which skips the soleus entirely",
    ],
  },

  glutes: {
    muscles: [
      { name: "Gluteus maximus", role: "The big one — extends the hip; the strongest muscle you own" },
      { name: "Gluteus medius", role: "Side of the hip — pulls the leg out and stops the pelvis dropping" },
      { name: "Gluteus minimus", role: "Underneath the medius, same job" },
    ],
    what:
      "Glute max drives hip extension: standing up out of a squat, the top of a deadlift, sprinting. Medius and minimus are stabilisers — they stop your pelvis tipping every time you stand on one leg, which is most of walking and all of running.",
    how:
      "Hinges and hip thrusts for the max, abduction work for the medius. 10–16 sets a week. Thrust variations train it in a shortened position and RDLs in a stretched one, so doing both covers more than either alone. Abduction work is the piece most people skip and the piece that quietly fixes knee pain.",
    patterns: ["Hip thrust / bridge", "Hinge / RDL", "Abduction", "Single-leg work"],
    mistakes: [
      "Arching the lower back at the top of a thrust instead of finishing with the hip",
      "Turning every thrust into a quad exercise by setting the feet too close",
      "No direct abduction work, which leaves the medius weak and the knees caving",
      "Chasing load on thrusts past the point where you can still finish the rep",
    ],
  },

  core: {
    muscles: [
      { name: "Rectus abdominis", role: "The visible one — bends the spine forward" },
      { name: "Obliques (internal & external)", role: "Rotate and side-bend the trunk" },
      { name: "Transverse abdominis", role: "Deepest layer — wraps around like a belt and braces" },
      { name: "Erector spinae", role: "The other half of the brace, running up the back" },
    ],
    what:
      "The core's real job is resisting movement, not creating it. Under a heavy bar it stops your spine from bending, rotating or collapsing sideways. Training it as a brace transfers to everything else you lift; training it only as a spine-bender mostly doesn't.",
    how:
      "Work the three anti-patterns: anti-extension (dead bug, ab rollout, plank), anti-rotation (Pallof press), and anti-lateral-flexion (suitcase carry, side plank). Add loaded carries. 8–15 sets a week, and unlike most muscles it responds well to being trained near-daily at low intensity. Breathe throughout — bracing is not the same thing as holding your breath.",
    patterns: ["Anti-extension", "Anti-rotation", "Anti-lateral flexion", "Loaded carry", "Flexion"],
    mistakes: [
      "Hundreds of crunches and nothing else",
      "Letting the lower back arch off the floor during dead bugs, which removes the whole point",
      "Holding your breath to brace instead of breathing behind the brace",
      "Training flexion only and never rotation or carries",
    ],
  },
};
