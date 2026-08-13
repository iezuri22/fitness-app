/**
 * Static catalog of bundled exercise GIFs under /public/gifs/.
 *
 * Each entry maps a media slug → list of name patterns that should use it.
 * Patterns are normalized (lowercased, stripped of punctuation) and matched
 * against the exercise name via `findGifForName` — this lets the seed data,
 * user-added exercises, and Coach-generated workouts all resolve to the same
 * underlying media without anyone having to set gifUrl explicitly.
 *
 * To add a new GIF:
 *   1. Drop it in /public/gifs/<slug>.gif (or .png/.jpg for static)
 *   2. Add an entry here with its slug and matching name patterns
 *   3. (Optional) Run the one-shot backfill in hooks/useBackfillGifs to apply
 *      it to existing Firestore exercises.
 *
 * Matcher order matters — longer / more-specific patterns should come first so
 * they aren't swallowed by generic prefixes (e.g. "banded goblet squat" must
 * match before "squat").
 */

type GifEntry = {
  slug: string;
  /** Optional file extension (default "gif"). Use for static PNG/JPG/WebP entries. */
  ext?: "gif" | "png" | "jpg" | "webp";
  /**
   * Two-frame photo demo stored as `<slug>-0.jpg` + `<slug>-1.jpg`. Resolves to
   * the `-0` frame; ExerciseGif detects the suffix and cross-fades to `-1` so
   * it animates like the bundled GIFs without needing a GIF encoder.
   */
  frames?: 2;
  /** Any of these substrings (normalized) in an exercise name triggers this media. */
  matches: string[];
};

const CATALOG: GifEntry[] = [
  // --- USER-ADDED DEMOS (managed by scripts/add-demos.mjs) ---
  { slug: "l-sit-hold", ext: "webp", matches: ["l sit hold"] },
  { slug: "kettlebell-halo", matches: ["kettlebell halo"] },
  { slug: "kettlebell-bottoms-up-curl", matches: ["kettlebell bottoms up curl"] },
  { slug: "isometric-shoulder-abduction-wall", ext: "jpg", matches: ["isometric shoulder abduction wall"] },
  { slug: "hollow-to-arch-transition", ext: "jpg", matches: ["hollow to arch transition"] },
  { slug: "hollow-rock", matches: ["hollow rock"] },
  { slug: "hollow-hold", matches: ["hollow hold"] },
  { slug: "hamstring-floss", matches: ["hamstring floss"] },
  { slug: "halasana-plow-pose", matches: ["halasana plow pose"] },
  { slug: "foam-roll-pecs", matches: ["foam roll pecs"] },
  { slug: "dumbbell-devil-press", matches: ["dumbbell devil press"] },
  { slug: "dowel-assisted-standing-abduction-lef", ext: "jpg", matches: ["dowel assisted standing abduction lef"] },
  { slug: "banded-sleeper-stretch-gentle", matches: ["banded sleeper stretch gentle"] },
  { slug: "banded-shoulder-distraction", ext: "jpg", matches: ["banded shoulder distraction"] },
  { slug: "band-clamshell", matches: ["band clamshell"] },
  { slug: "adho-mukha-svanasana-downward-facing-dog", ext: "jpg", matches: ["adho mukha svanasana downward facing dog"] },
  { slug: "90-90-hip-stretch", matches: ["90 90 hip stretch"] },
  // --- GYM: machines, barbells, cables (2-frame photo demos) ---
  // Listed first so specific gym names win over the generic band/dumbbell
  // illustrations further down. Patterns are deliberately multi-word so they
  // can't swallow home/PT exercise names.
  // Guard: keep the one-arm band variant on its own illustration, since the
  // generic "lat pulldown" pattern below would otherwise capture it.
  { slug: "one-arm-lat-pulldown", matches: ["single arm band lat pulldown", "one arm lat pulldown"] },

  { slug: "stairmaster", frames: 2, matches: ["stair climber", "stairmaster", "stair master"] },
  { slug: "trap-bar-deadlift", frames: 2, matches: ["trap bar deadlift", "hex bar deadlift"] },
  { slug: "hack-squat-machine", frames: 2, matches: ["hack squat"] },
  { slug: "barbell-front-squat", frames: 2, matches: ["barbell front squat", "front squat"] },
  { slug: "barbell-back-squat", frames: 2, matches: ["barbell back squat", "back squat", "barbell squat"] },
  { slug: "smith-machine-squat", frames: 2, matches: ["smith machine squat"] },
  { slug: "barbell-sumo-deadlift", frames: 2, matches: ["barbell sumo deadlift"] },
  { slug: "barbell-romanian-deadlift", frames: 2, matches: ["barbell romanian deadlift"] },
  { slug: "barbell-deadlift", frames: 2, matches: ["barbell deadlift", "conventional deadlift"] },
  { slug: "barbell-good-morning", frames: 2, matches: ["barbell good morning"] },
  { slug: "barbell-walking-lunge", frames: 2, matches: ["barbell walking lunge"] },
  { slug: "leg-press-calf-raise", frames: 2, matches: ["leg press calf raise"] },
  { slug: "leg-press", frames: 2, matches: ["leg press"] },
  { slug: "leg-extension-machine", frames: 2, matches: ["leg extension"] },
  { slug: "seated-leg-curl", frames: 2, matches: ["seated leg curl"] },
  { slug: "lying-leg-curl", frames: 2, matches: ["lying leg curl", "leg curl"] },
  { slug: "hip-abduction-machine", frames: 2, matches: ["hip abduction machine", "abduction machine"] },
  { slug: "hip-adduction-machine", frames: 2, matches: ["hip adduction machine", "adduction machine"] },
  { slug: "glute-kickback-machine", frames: 2, matches: ["glute kickback machine", "glute kickback"] },
  { slug: "seated-calf-raise-machine", frames: 2, matches: ["seated calf raise machine"] },
  { slug: "standing-calf-raise-machine", frames: 2, matches: ["standing calf raise"] },
  { slug: "back-extension-45", frames: 2, matches: ["back extension", "hyperextension"] },
  { slug: "sled-push", frames: 2, matches: ["sled push"] },
  { slug: "machine-chest-press", frames: 2, matches: ["machine chest press"] },
  { slug: "incline-dumbbell-bench-press", frames: 2, matches: ["incline dumbbell bench press", "incline dumbbell press"] },
  { slug: "close-grip-bench-press", frames: 2, matches: ["close grip bench press"] },
  { slug: "barbell-bench-press", frames: 2, matches: ["barbell bench press"] },
  { slug: "machine-shoulder-press", frames: 2, matches: ["machine shoulder press"] },
  { slug: "pec-deck-fly", frames: 2, matches: ["pec deck"] },
  { slug: "cable-crossover", frames: 2, matches: ["cable crossover"] },
  { slug: "assisted-dip-machine", frames: 2, matches: ["assisted dip"] },
  { slug: "parallel-bar-dip", frames: 2, matches: ["dip parallel bars", "parallel bar dip"] },
  { slug: "close-grip-lat-pulldown", frames: 2, matches: ["close grip lat pulldown"] },
  { slug: "lat-pulldown", frames: 2, matches: ["lat pulldown"] },
  { slug: "t-bar-row", frames: 2, matches: ["t bar row"] },
  { slug: "seated-cable-rows", matches: ["chest supported row", "chest supported machine row"] },
  { slug: "assisted-pullup-machine", frames: 2, matches: ["assisted pull up machine", "assisted pull up"] },
  { slug: "barbell-shrug", frames: 2, matches: ["barbell shrug"] },
  { slug: "ez-bar-skullcrusher", frames: 2, matches: ["ez bar skull crusher", "ez bar skullcrusher"] },
  { slug: "ez-bar-curl", frames: 2, matches: ["ez bar curl"] },
  { slug: "barbell-curl", frames: 2, matches: ["barbell curl"] },
  { slug: "cable-rope-hammer-curl", frames: 2, matches: ["cable rope hammer curl"] },
  { slug: "cable-curl", frames: 2, matches: ["cable curl"] },
  { slug: "cable-woodchopper", frames: 2, matches: ["cable woodchopper", "woodchopper", "woodchop", "wood chop"] },
  { slug: "cable-crunch", frames: 2, matches: ["cable crunch"] },
  { slug: "ab-crunch-machine", frames: 2, matches: ["ab crunch machine"] },
  { slug: "rowing-machine", frames: 2, matches: ["rowing machine", "rowing erg"] },
  { slug: "elliptical-trainer", frames: 2, matches: ["elliptical"] },

  // --- Expanded gym set ---
  { slug: "rack-pull", frames: 2, matches: ["rack pull"] },
  { slug: "reverse-hyperextension", frames: 2, matches: ["reverse hyperextension"] },
  { slug: "sissy-squat", frames: 2, matches: ["sissy squat"] },
  { slug: "step-up-knee-raise", frames: 2, matches: ["step up with knee raise"] },
  { slug: "front-box-jump", frames: 2, matches: ["front box jump", "box jump"] },
  { slug: "barbell-overhead-press", frames: 2, matches: ["barbell overhead press", "barbell shoulder press"] },
  { slug: "decline-barbell-bench-press", frames: 2, matches: ["decline barbell bench press"] },
  { slug: "incline-cable-chest-press", frames: 2, matches: ["incline cable chest press"] },
  { slug: "incline-cable-fly", frames: 2, matches: ["incline cable fly"] },
  { slug: "front-plate-raise", frames: 2, matches: ["front plate raise"] },
  { slug: "seated-lateral-raise", frames: 2, matches: ["seated lateral raise"] },
  { slug: "reverse-pec-deck", frames: 2, matches: ["reverse pec deck"] },
  { slug: "cable-shrug", frames: 2, matches: ["cable shrug"] },
  { slug: "weighted-pull-up", frames: 2, matches: ["weighted pull up"] },
  { slug: "triceps-pushdown-vbar", frames: 2, matches: ["triceps pushdown v bar", "tricep pushdown v bar"] },
  { slug: "machine-bicep-curl", frames: 2, matches: ["machine bicep curl"] },
  { slug: "decline-crunch", frames: 2, matches: ["decline crunch"] },
  { slug: "cable-russian-twist", frames: 2, matches: ["cable russian twist"] },
  { slug: "farmers-walk", frames: 2, matches: ["farmer s walk", "farmers walk", "farmer walk", "farmer carry"] },
  { slug: "worlds-greatest-stretch", frames: 2, matches: ["world s greatest stretch", "worlds greatest stretch", "spiderman lunge"] },

  // --- Sled / strongman + more gym machines ---
  { slug: "sled-drag-harness", frames: 2, matches: ["sled pull", "harness drag", "sled drag", "sled backward drag", "backward sled"] },
  { slug: "sled-row", frames: 2, matches: ["sled row"] },
  { slug: "sledgehammer-swings", frames: 2, matches: ["sledgehammer"] },
  { slug: "smith-machine-bench-press", frames: 2, matches: ["smith machine bench press"] },
  { slug: "smith-machine-bent-over-row", frames: 2, matches: ["smith machine bent over row"] },
  { slug: "smith-machine-calf-raise", frames: 2, matches: ["smith machine calf raise"] },
  { slug: "machine-bench-press", frames: 2, matches: ["machine bench press"] },
  { slug: "standing-military-press", frames: 2, matches: ["standing military press", "military press"] },
  { slug: "landmine-180", frames: 2, matches: ["landmine 180"] },
  { slug: "cable-seated-lateral-raise", frames: 2, matches: ["cable seated lateral raise"] },
  { slug: "dumbbell-incline-row", frames: 2, matches: ["dumbbell incline row"] },
  { slug: "cable-deadlift", frames: 2, matches: ["cable deadlift"] },
  { slug: "clean-deadlift", frames: 2, matches: ["clean deadlift"] },
  { slug: "machine-preacher-curl", frames: 2, matches: ["machine preacher curl"] },
  { slug: "cable-incline-pushdown", frames: 2, matches: ["cable incline pushdown"] },

  // --- HOME / PT: foam rolling, core, mobility ---
  { slug: "foam-roll-quads", frames: 2, matches: ["foam roll quad"] },
  { slug: "foam-roll-it-band", frames: 2, matches: ["foam roll it band"] },
  { slug: "foam-roll-hamstrings", frames: 2, matches: ["foam roll hamstring"] },
  { slug: "foam-roll-lats", frames: 2, matches: ["foam roll lat"] },
  { slug: "foam-roll-upper-back", frames: 2, matches: ["foam roll upper back"] },
  { slug: "foam-roll-lower-back", frames: 2, matches: ["foam roll lower back", "foam roll low back"] },
  { slug: "reverse-flyes", frames: 2, matches: ["reverse fly", "prone t raise"] },
  { slug: "plie-squat", frames: 2, matches: ["sumo squat", "plie squat"] },
  { slug: "bodyweight-walking-lunge", frames: 2, matches: ["forward lunge"] },
  { slug: "flutter-kicks", frames: 2, matches: ["flutter kick"] },
  { slug: "jackknife-situp", frames: 2, matches: ["v up", "jackknife sit up"] },
  { slug: "tuck-crunch", frames: 2, matches: ["tuck up", "tuck crunch"] },
  { slug: "seated-leg-tucks", frames: 2, matches: ["seated leg tuck"] },
  { slug: "kettlebell-thruster", frames: 2, matches: ["thruster"] },
  { slug: "wrist-circles", frames: 2, matches: ["wrist cars", "wrist circle"] },
  { slug: "shoulder-circles", frames: 2, matches: ["shoulder cars", "shoulder circle"] },
  { slug: "front-squat-clean-grip", frames: 2, matches: ["front rack squat"] },
  { slug: "hip-circles-prone", frames: 2, matches: ["fire hydrant", "hip circles prone"] },
  { slug: "one-half-locust", frames: 2, matches: ["locust"] },
  { slug: "alternate-heel-touchers", frames: 2, matches: ["heel tap", "heel touch"] },
  { slug: "scapular-pull-up", frames: 2, matches: ["scapular retraction"] },
  { slug: "side-split-squat", frames: 2, matches: ["cossack squat", "side split squat"] },
  { slug: "natural-glute-ham-raise", frames: 2, matches: ["nordic hamstring curl", "glute ham raise"] },
  { slug: "standing-long-jump", frames: 2, matches: ["broad jump", "standing long jump"] },
  { slug: "groin-stretch", frames: 2, matches: ["frog stretch", "groin stretch"] },
  { slug: "torso-rotation", frames: 2, matches: ["thread the needle", "torso rotation"] },

  // --- Reuse existing bundled media for equivalent movements ---
  // (same motion, different implement/tempo — no new asset needed)
  { slug: "tricep-dumbbell-kickback", matches: ["tricep kickback"] },
  { slug: "kettlebell-turkish-get-up-lunge-style", matches: ["turkish get up", "turkish half get up"] },
  { slug: "farmers-walk", frames: 2, matches: ["suitcase carry"] },
  { slug: "bodyweight-squat", matches: ["pulse squat", "tempo squat", "heel elevated squat", "cyclist squat"] },
  { slug: "pallof-press", matches: ["pallof hold"] },
  { slug: "dumbbell-curl", matches: ["21s"] },
  { slug: "close-grip-dumbbell-press", matches: ["squeeze press"] },
  { slug: "dumbbell-one-arm-shoulder-press", matches: ["half kneeling press", "band overhead press"] },
  { slug: "one-arm-kettlebell-floor-press", matches: ["bottoms up floor press"] },
  { slug: "alternating-kettlebell-press", matches: ["bottoms up press"] },
  { slug: "dumbbell-raise", matches: ["scaption"] },
  { slug: "dumbbell-lunges", matches: ["lateral lunge", "curtsy lunge"] },
  { slug: "calf-raise-on-a-dumbbell", matches: ["single leg calf raise"] },
  { slug: "dumbbell-romanian-deadlift", matches: ["dumbbell deadlift"] },
  { slug: "sumo-deadlift", matches: ["kettlebell deadlift"] },
  { slug: "middle-chest-fly-band", matches: ["chest fly", "low to high fly"] },
  { slug: "lateral-bound", matches: ["skater jump"] },
  { slug: "kneeling-hip-flexor-stretch", matches: ["couch stretch"] },
  { slug: "wall-isometric-flexion-left", matches: ["isometric shoulder flexion"] },
  { slug: "band-internal-rotation", matches: ["isometric shoulder internal rotation"] },
  { slug: "external-rotation", matches: ["isometric shoulder external rotation"] },
  { slug: "shoulder-stretch", matches: ["pulley assisted"] },
  { slug: "kettlebell-pistol-squat", matches: ["shrimp squat"] },
  { slug: "hip-abduction-machine", frames: 2, matches: ["standing hip abduction"] },

  // --- Shoulder / PT / rehab ---
  { slug: "scapular-wall-slides", matches: ["scapular wall slide", "wall slide baseball"] },
  { slug: "serratus-wall-slide-with-foam-roller", matches: ["serratus wall slide", "foam roller serratus"] },
  { slug: "foam-roller-thoracic-extension", matches: ["foam roller thoracic", "thoracic extension foam"] },
  { slug: "foam-roller-back-stretch", matches: ["foam roller back"] },
  { slug: "foam-roller-glutes", matches: ["foam roller glute"] },
  { slug: "foam-roller-calves", matches: ["foam roller calves", "foam roller calf"] },
  { slug: "band-external-rotation", matches: ["band external rotation", "external rotation band"] },
  { slug: "band-internal-rotation", matches: ["band internal rotation", "internal rotation band"] },
  { slug: "external-rotation-left", matches: ["external rotation left", "external rotation - left"] },
  { slug: "external-rotation-right", matches: ["external rotation right", "external rotation - right"] },
  { slug: "wall-isometric-flexion-left", matches: ["wall isometric flexion", "isometric flexion"] },
  { slug: "resisted-standing-shoulder-extension", matches: ["resisted standing shoulder extension", "standing shoulder extension"] },
  { slug: "resisted-standing-row", matches: ["resisted standing row", "standing band row", "resisted row"] },
  { slug: "resisted-eccentric-external-rotation-walk-out-left", matches: ["eccentric external rotation walk out", "walk out external rotation"] },
  { slug: "towel-flexion-wall-slide-left", matches: ["towel flexion wall slide", "towel wall slide"] },
  { slug: "dowelassisted-overhead-reach", matches: ["dowel assisted overhead reach", "dowel overhead reach", "dowel-assisted overhead"] },
  { slug: "band-pullapart", matches: ["band pull apart", "band pullapart", "pull apart band"] },

  // --- Glutes / posterior chain ---
  { slug: "glute-bridge", matches: ["glute bridge"] },
  { slug: "banded-glute-bridge", matches: ["banded glute bridge", "glute bridge banded", "glute bridge band"] },
  { slug: "singleleg-glute-bridge-with-kb", matches: ["single leg glute bridge", "single-leg glute bridge", "singleleg glute bridge"] },
  { slug: "barbell-hip-thrusts", matches: ["barbell hip thrust", "hip thrust"] },
  { slug: "barbell-single-leg-hip-thrust", matches: ["single leg hip thrust", "single-leg hip thrust"] },
  { slug: "frog-pump", matches: ["frog pump"] },
  { slug: "bridge-hip-abduction", matches: ["bridge hip abduction", "hip abduction bridge"] },
  { slug: "barbell-glute-bridge-two-legs-on-bench", matches: ["glute bridge on bench", "glute bridge bench"] },
  { slug: "cable-donkey-kickback", matches: ["donkey kick", "cable kickback"] },
  { slug: "cable-hip-abduction-cable-hip-adduction", matches: ["cable hip abduction", "cable hip adduction", "hip abduction cable"] },
  { slug: "dumbbell-romanian-deadlift", matches: ["romanian deadlift", "rdl", "kettlebell romanian deadlift", "kb romanian deadlift"] },
  { slug: "bstance-kb-romanian-deadlift", ext: "jpg", matches: ["b-stance", "b stance", "bstance kb", "b-stance kb"] },
  { slug: "kettlebell-single-leg-deadlift", matches: ["kettlebell single leg deadlift", "single leg deadlift", "kb single leg deadlift"] },
  { slug: "good-morning", matches: ["good morning"] },
  { slug: "smith-machine-good-morning", matches: ["smith machine good morning", "smith good morning"] },

  // --- Legs / squats ---
  { slug: "dumbbell-bulgarian-split-squat", matches: ["bulgarian split squat", "split squat"] },
  { slug: "banded-goblet-squat", matches: ["banded goblet squat", "goblet squat band"] },
  { slug: "dumbbell-walking-lunge", matches: ["walking lunge", "dumbbell lunge"] },
  { slug: "dumbbell-stepup", matches: ["step up", "step-up", "stepup"] },
  { slug: "barbell-jump-squat", matches: ["jump squat", "barbell jump squat"] },
  { slug: "box-jump-to-pistol-squat", matches: ["box jump to pistol squat", "box jump pistol", "pistol squat jump"] },
  { slug: "landmine-squat-to-press", matches: ["landmine squat to press", "landmine squat press"] },

  // --- Chest / press ---
  { slug: "dumbbell-bench-press", matches: ["dumbbell bench press", "db bench", "neutral grip floor press"] },
  { slug: "incline-barbell-bench-press", matches: ["incline bench press", "incline barbell bench", "incline chest press"] },
  { slug: "banded-floor-press", matches: ["banded floor press", "floor press band"] },
  { slug: "standing-band-chest-press", matches: ["standing band chest press", "standing chest press band"] },
  { slug: "dumbbell-fly", matches: ["dumbbell fly", "db fly", "dumbbell chest fly"] },
  { slug: "middle-chest-fly-band", matches: ["band fly", "middle chest fly", "chest fly band"] },
  { slug: "push-press", matches: ["push press"] },
  { slug: "kneeling-landmine-press", matches: ["landmine press", "kneeling landmine", "tall kneeling landmine"] },
  { slug: "pushup-toe-touch", matches: ["pushup toe touch", "push up toe touch", "push-up toe touch"] },
  { slug: "one-leg-pushup", matches: ["one leg pushup", "single leg pushup", "one-leg push up"] },
  { slug: "bench-dips", matches: ["bench dip"] },

  // --- Back / pull ---
  { slug: "chin-up", matches: ["chin up", "chinup", "chin-up"] },
  { slug: "brachialis-pullup", matches: ["brachialis pullup", "brachialis pull up", "neutral grip pullup"] },
  { slug: "human-flag", matches: ["human flag"] },
  { slug: "one-arm-cable-row", matches: ["single arm row", "one arm row", "db row", "dumbbell row", "cable row", "band row"] },
  { slug: "face-pull-band", matches: ["face pull"] },
  { slug: "cable-pulldown-biceps-curl", matches: ["cable pulldown biceps curl", "pulldown curl"] },

  // --- Arms ---
  { slug: "dumbbell-curl", matches: ["bicep curl", "dumbbell curl", "db curl"] },
  { slug: "seated-hammer-curl", matches: ["hammer curl", "seated hammer"] },
  { slug: "double-arm-dumbbell-curl", matches: ["double arm dumbbell curl", "double arm curl", "two arm curl"] },
  { slug: "band-tricep-pushdown", matches: ["band tricep pushdown", "tricep pushdown band", "band pushdown", "rope pushdown", "cable pushdown"] },
  { slug: "cable-rope-overhead-triceps-extension", matches: ["overhead triceps extension", "overhead tricep extension", "rope overhead triceps"] },
  { slug: "one-arm-lying-triceps-extension", matches: ["one arm lying triceps", "lying triceps extension", "skull crusher"] },

  // --- Olympic / power ---
  { slug: "barbell-snatch", matches: ["barbell snatch", "snatch", "power snatch"] },
  { slug: "power-clean", matches: ["power clean", "clean"] },
  { slug: "backward-medicine-ball-throw", matches: ["medicine ball throw", "backward medicine ball", "med ball throw"] },

  // --- Core ---
  { slug: "bicycle-crunch", matches: ["bicycle crunch"] },
  { slug: "captains-chair-leg-raise", matches: ["captains chair", "hanging knee raise", "hanging leg raise"] },
  { slug: "ab-roller-crunch", matches: ["ab roller crunch", "roller crunch", "ab roller"] },
  { slug: "barbell-rollout-ab-roller", matches: ["barbell rollout", "ab rollout"] },
  { slug: "bird-dog", matches: ["bird dog"] },
  { slug: "mountain-climber", matches: ["mountain climber"] },
  { slug: "side-plank-rotation", matches: ["side plank rotation"] }, // banned — but show so user sees why

  // --- Cardio ---
  { slug: "burpees", matches: ["burpee"] },
  { slug: "bike", matches: ["bike", "bicycle", "cycling", "stationary bike", "spin"] },
  { slug: "jump-rope", matches: ["jump rope", "jumping rope", "rope jump"] },
  { slug: "kettlebell-swings", matches: ["kettlebell swing", "kb swing"] },
  { slug: "running", matches: ["running", "run "] },
  { slug: "hike", matches: ["hike", "hiking", "walk", "treadmill"] },
  { slug: "ski-ergometer", matches: ["ski erg", "ski ergometer", "skierg"] },

  // --- Stretches / yoga / mobility ---
  { slug: "catcow-pose", matches: ["cat cow", "cat-cow", "catcow"] },
  { slug: "childs-pose", matches: ["child pose", "childs pose", "child's pose"] },
  { slug: "balasana-child-pose", matches: ["balasana"] },
  { slug: "doorway-chest-stretch", matches: ["doorway chest stretch", "chest doorway stretch"] },
  { slug: "figure-four-glute-stretch", matches: ["figure four", "figure 4 glute", "figure-4"] },
  { slug: "standing-hamstring-stretch", matches: ["standing hamstring"] },
  { slug: "kneeling-hip-flexor-stretch", matches: ["hip flexor stretch", "kneeling hip flexor"] },
  { slug: "standing-quad-stretch", matches: ["standing quad", "quad stretch"] },
  { slug: "bhujangasana-cobra-abdominal-stretch", matches: ["cobra", "bhujangasana"] },
  { slug: "ustrasana", matches: ["ustrasana"] },
  { slug: "utthita-trikonasana-extended-triangle-pose", matches: ["trikonasana", "triangle pose"] },
  { slug: "tiger-yoga-pose", matches: ["tiger pose", "tiger yoga"] },
  { slug: "ardha-kapotasana-half-pigeon-pose", matches: ["pigeon pose", "ardha kapotasana", "kapotasana"] },
  { slug: "warrior-pose", matches: ["warrior pose", "warrior 1", "warrior 2", "virabhadrasana"] },
  { slug: "camel-pose", ext: "png", matches: ["camel pose"] },
  { slug: "titli-asana-butterfly-pose", matches: ["butterfly pose", "titli asana", "titli-asana"] },
  { slug: "upavistha-konasana", matches: ["upavistha", "konasana", "wide legged forward fold"] },
  { slug: "nauka-sanchalanasan-rowing-the-boat-pose", matches: ["rowing the boat", "nauka sanchalanasan"] },

  // --- Auto-added from yuhonas/free-exercise-db (2-frame illustrations) ---
  { slug: "arnold-dumbbell-press", matches: ["dumbbell arnold press neutral to neutral", "arnold dumbbell press"] },
  { slug: "kettlebell-turkish-get-up-lunge-style", matches: ["kettlebell turkish get up lunge style", "kettlebell turkish get up"] },
  { slug: "dumbbell-one-arm-shoulder-press", matches: ["dumbbell single arm shoulder press", "dumbbell one arm shoulder press"] },
  { slug: "cable-preacher-curl", matches: ["band preacher curl over couch arm", "cable preacher curl", "preacher curl"] },
  { slug: "calf-stretch-elbows-against-wall", matches: ["calf stretch elbows against wall", "calf stretch at wall"] },
  { slug: "cable-one-arm-tricep-extension", matches: ["band single arm tricep extension", "cable one arm tricep extension"] },
  { slug: "dumbbell-floor-press", matches: ["single arm dumbbell floor press", "dumbbell z press seated floor", "dumbbell floor press"] },
  { slug: "close-grip-dumbbell-press", matches: ["dumbbell close grip floor press", "close grip dumbbell press"] },
  { slug: "standing-dumbbell-reverse-curl", matches: ["standing dumbbell reverse curl", "dumbbell reverse curl"] },
  { slug: "one-arm-kettlebell-floor-press", matches: ["one arm kettlebell floor press", "kettlebell floor press"] },
  { slug: "stiff-legged-dumbbell-deadlift", matches: ["stiff legged dumbbell deadlift", "dumbbell stiff leg deadlift"] },
  { slug: "external-rotation", matches: ["prone external rotation at 90", "side lying external rotation", "external rotation"] },
  { slug: "calf-raise-on-a-dumbbell", matches: ["seated calf raise db on knee", "calf raise on a dumbbell", "dumbbell calf raise"] },
  { slug: "leverage-decline-chest-press", matches: ["leverage decline chest press", "band decline chest press"] },
  { slug: "one-arm-lat-pulldown", matches: ["single arm band lat pulldown", "one arm lat pulldown"] },
  { slug: "alternating-kettlebell-press", matches: ["alternating kettlebell press", "kettlebell squat to press"] },
  { slug: "concentration-curls", matches: ["dumbbell concentration curl", "band concentration curl", "concentration curls"] },
  { slug: "cable-chest-press", matches: ["single arm band chest press", "cable chest press"] },
  { slug: "incline-push-up-close-grip", matches: ["incline push up close grip", "close grip push up"] },
  { slug: "bent-over-two-dumbbell-row", matches: ["bent over two dumbbell row", "dumbbell bent over row"] },
  { slug: "straight-arm-pulldown", matches: ["band straight arm pulldown", "straight arm pulldown"] },
  { slug: "flat-bench-lying-leg-raise", matches: ["flat bench lying leg raise", "lying leg raise"] },
  { slug: "alternating-kettlebell-row", matches: ["alternating kettlebell row", "kettlebell renegade row"] },
  { slug: "cuban-press", matches: ["dumbbell cuban press light", "cuban press"] },
  { slug: "one-legged-cable-kickback", matches: ["one legged cable kickback", "band kickback"] },
  { slug: "tricep-dumbbell-kickback", matches: ["dumbbell tricep kickback", "tricep dumbbell kickback"] },
  { slug: "sumo-deadlift", matches: ["kettlebell sumo deadlift", "sumo deadlift"] },
  { slug: "hamstring-stretch", matches: ["banded hamstring stretch", "hamstring stretch"] },
  { slug: "lateral-raise-with-bands", matches: ["lateral raise with bands", "band lateral raise", "cable lateral raise"] },
  { slug: "inverted-row", matches: ["inverted row under table", "inverted row"] },
  { slug: "alternating-renegade-row", matches: ["alternating renegade row", "dumbbell renegade row"] },
  { slug: "overhead-stretch", matches: ["overhead tricep stretch", "overhead stretch"] },
  { slug: "shoulder-stretch", matches: ["shoulder pulley stretch", "shoulder stretch"] },
  { slug: "dumbbell-raise", matches: ["dumbbell scaption raise", "dumbbell lateral raise", "dumbbell raise"] },
  { slug: "goblet-squat", matches: ["kettlebell goblet squat", "goblet squat"] },
  { slug: "crossover-reverse-lunge", matches: ["crossover reverse lunge", "reverse lunge"] },
  { slug: "kettlebell-pistol-squat", matches: ["kettlebell pistol squat", "pistol squat"] },
  { slug: "russian-twist", matches: ["weighted russian twist", "russian twist"] },
  { slug: "dumbbell-lunges", matches: ["dumbbell reverse lunge", "dumbbell lateral lunge", "dumbbell curtsy lunge", "dumbbell lunges"] },
  { slug: "cable-rear-delt-fly", matches: ["dumbbell rear delt fly", "cable rear delt fly", "band rear delt fly", "rear delt fly"] },
  { slug: "incline-dumbbell-curl", matches: ["incline dumbbell curl", "dumbbell incline curl"] },
  { slug: "push-up-to-side-plank", matches: ["push up to side plank", "plank to push up"] },
  { slug: "zottman-curl", matches: ["dumbbell zottman curl", "zottman curl"] },
  { slug: "dumbbell-squat", matches: ["dumbbell goblet squat", "dumbbell squat"] },
  { slug: "bent-over-barbell-row", matches: ["bent over barbell row", "band bent over row"] },
  { slug: "bear-crawl-sled-drags", matches: ["bear crawl sled drags", "bear crawl"] },
  { slug: "front-dumbbell-raise", matches: ["dumbbell front raise", "front dumbbell raise"] },
  { slug: "narrow-stance-squats", matches: ["narrow stance squats", "narrow stance squat"] },
  { slug: "spider-curl", matches: ["dumbbell spider curl", "spider curl"] },
  { slug: "standing-toe-touches", matches: ["standing toe touches", "toe touches"] },
  { slug: "tate-press", matches: ["dumbbell tate press", "tate press"] },
  { slug: "pull-through", matches: ["banded pull through", "pull through"] },
  { slug: "elevated-cable-rows", matches: ["elevated cable rows", "band high row"] },
  { slug: "dead-bug", matches: ["dead bug with band", "dead bug"] },
  { slug: "drag-curl", matches: ["dumbbell drag curl", "drag curl"] },
  { slug: "pallof-press", matches: ["band pallof press", "pallof press"] },
  { slug: "seated-cable-rows", matches: ["seated cable rows", "seated cable row", "band seated row"] },
  { slug: "front-cable-raise", matches: ["front cable raise", "band front raise"] },
  { slug: "bodyweight-squat", matches: ["bodyweight squat"] },
  { slug: "incline-push-up", matches: ["incline push up"] },
  { slug: "decline-push-up", matches: ["decline push up"] },
  { slug: "dumbbell-shrug", matches: ["dumbbell shrug"] },
  { slug: "knee-tuck-jump", matches: ["knee tuck jump", "tuck jump"] },
  { slug: "side-jackknife", matches: ["side jackknife", "jackknife"] },
  { slug: "lateral-bound", matches: ["lateral bound"] },
  { slug: "superman", matches: ["superman hold", "superman"] },
  { slug: "plank", matches: ["forearm plank", "plank"] },
  { slug: "push-up-wide", matches: ["wide push up", "push up wide"] },
  { slug: "scissor-kick", matches: ["scissor kick"] },
  { slug: "pushups", matches: ["push up", "pushups"] },
  { slug: "sit-up", matches: ["sit up"] },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Look up a GIF URL for an exercise name. Returns undefined if no match.
 *  Two-frame entries resolve to their `-0.jpg` frame; ExerciseGif animates it. */
export function findGifForName(name: string): string | undefined {
  const n = normalize(name);
  for (const entry of CATALOG) {
    for (const m of entry.matches) {
      if (n.includes(normalize(m))) {
        return entry.frames === 2
          ? `/gifs/${entry.slug}-0.jpg`
          : `/gifs/${entry.slug}.${entry.ext ?? "gif"}`;
      }
    }
  }
  return undefined;
}

/** Second frame path for a two-frame demo, or null for single-file media. */
export function secondFrameUrl(url: string): string | null {
  return url.endsWith("-0.jpg") ? url.replace(/-0\.jpg$/, "-1.jpg") : null;
}

/** Total number of bundled media entries — for debug / onboarding messaging. */
export const GIF_COUNT = CATALOG.length;
