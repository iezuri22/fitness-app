/**
 * Static lookup from normalized exercise name → short form cues.
 * Looked up at render time (ExerciseDetail) so existing Firestore docs get
 * instructions without any migration. User-added `notes` still wins.
 *
 * Keep each entry to 1–2 sentences, under ~220 chars. Focus on:
 *   (a) setup / start position, (b) the movement, (c) one key form cue.
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const INSTRUCTIONS: Record<string, string> = {
  // --- PT / Rehab (Athletico + home variants) ---
  "scapular wall slides":
    "Stand with back against wall, arms in 'W' with elbows bent. Slowly slide arms overhead keeping wrists and elbows on the wall, then return. Move only as high as you can stay flush.",
  "serratus wall slide with foam roller":
    "Place foam roller vertically against wall, forearms on it. Slowly slide roller overhead, reaching tall at the top to engage serratus. Lower with control.",
  "foam roller thoracic extension":
    "Lie on back, foam roller under mid-back, hands behind head. Arch gently over the roller to open upper back, breathing into the stretch. Roll up/down a few inches.",
  "foam roller back stretch":
    "Sit with roller behind you, lean back so roller sits under upper back. Roll slowly from mid to upper back, pausing on tight spots.",
  "foam roller glutes":
    "Sit on the roller with ankle crossed over opposite knee. Shift weight onto that glute and roll slowly, pausing on tight spots for 20–30s.",
  "foam roller calves":
    "Sit with calves on roller, hands behind you for support. Lift hips, roll from ankle to below the knee. Cross one leg over the other for more pressure.",
  "external rotation left":
    "Elbow tucked at ribs, forearm across body holding band/cable. Rotate forearm outward keeping elbow glued to side. Control the return — no shrugging.",
  "external rotation right":
    "Elbow tucked at ribs, forearm across body holding band/cable. Rotate forearm outward keeping elbow glued to side. Control the return — no shrugging.",
  "wall isometric flexion left":
    "Stand facing wall, soft fist at shoulder height lightly pushing into wall. Hold the push for 5–10s without forcing pain, then relax.",
  "resisted standing shoulder extension":
    "Hold band in front of hips with both hands. Keeping arms straight, drive band behind you by squeezing lats and rear delts. Return slowly.",
  "towel flexion wall slide left":
    "Place a folded towel against the wall at shoulder height. Press fist into towel and slowly slide it up the wall as far as comfortable. Lower with control.",
  "dowel assisted overhead reach":
    "Lie on back, hold a dowel with both hands overhead. Use the non-surgical arm to gently guide the surgical arm overhead, pausing at first stretch. No forcing.",
  "resisted standing row":
    "Anchor band at chest height, hold ends with arms extended. Row elbows straight back, squeezing shoulder blades together. Return slowly.",
  "dowel assisted standing external rotation left":
    "Hold dowel with both hands, elbow of the surgical arm tucked at ribs. Use the other hand to push the dowel outward, rotating the shoulder — pause at first resistance.",
  "dowel assisted standing abduction lef":
    "Hold dowel vertically with both hands at side. Use the good arm to gently lift the surgical arm out to the side, only as far as comfortable.",
  "resisted eccentric external rotation walk out left":
    "Anchor band at side, hold with surgical arm elbow at ribs. Start with hand across body, then slowly walk sideways away from anchor to lengthen the band — take 3–5s to walk out.",
  "band internal rotation":
    "Anchor band at elbow height, stand side-on, elbow tucked at ribs. Pull band across body toward belly keeping elbow glued. Slow return.",
  "band external rotation":
    "Anchor band at elbow height, stand with anchor on non-working side. Elbow at ribs, rotate forearm outward away from body. Slow return.",
  "band pull apart":
    "Hold band in front at shoulder height, arms straight. Pull band apart by driving arms out to sides, squeezing shoulder blades. Control the return.",
  "shoulder pulley stretch":
    "Seated or standing with door pulley set up. Use good arm to gently pull the surgical arm overhead or to the side, within pain-free range. Hold 20–30s.",
  "scapular push up":
    "From plank (or knees), arms straight, let shoulder blades squeeze together, then push floor away to round upper back. No elbow bend.",
  "wall scapular retraction":
    "Stand facing away from wall, elbows bent 90°. Press elbows into wall and squeeze shoulder blades together. Hold 5s, release.",
  "serratus punch supine":
    "Lie on back, light DB pressed straight up. Without bending elbow, punch weight a few inches toward ceiling to protract shoulder blade. Lower slowly.",
  "shoulder cars slow":
    "Arm at side. Slowly circle the shoulder through its full available range — forward, up, across, behind, down. Move slowly; stop at any pinch.",
  "wrist cars":
    "Arms extended, make large slow circles with the wrists, exploring full flexion/extension/rotation. 5–8 each direction.",
  "isometric shoulder flexion wall":
    "Stand facing wall, fist at shoulder height pressing forward into wall. Hold 5–10s at 50% effort. No pain.",
  "isometric shoulder abduction wall":
    "Stand side-on to wall, outside of hand pressing into wall at hip height. Hold 5–10s pushing outward at 50% effort.",
  "isometric shoulder internal rotation wall":
    "Elbow at ribs bent 90°, palm pressing into wall. Push hand into wall (toward belly) without moving. Hold 5–10s.",
  "isometric shoulder external rotation wall":
    "Elbow at ribs bent 90°, back of hand pressing into wall. Push outward into wall without moving. Hold 5–10s.",
  "band scapular retraction":
    "Band anchored in front, hold with arms straight. Without bending elbows, pull shoulder blades back and down. Small but focused.",
  "side lying external rotation":
    "Lie on side, light DB in top hand, elbow bent 90° resting on ribs. Rotate forearm up toward ceiling, elbow glued to side. Lower slowly.",
  "prone external rotation at 90":
    "Lie face down on bench or bed with arm off edge, elbow bent 90° at shoulder height. Rotate forearm up until parallel with floor. Light weight only.",
  "resisted scaption raise":
    "Stand on band with slack. Raise arms in a 'scarecrow' angle (30° in front of body) to shoulder height, thumbs up. Lower slowly.",
  "banded sleeper stretch gentle":
    "Side-lying on surgical shoulder, elbow at 90° pointing forward. GENTLY press forearm toward floor — stop at first real tension. Hold 20–30s.",
  "pulley assisted flexion":
    "Seated, door pulley overhead, surgical arm in cuff. Pull down with good arm to raise surgical arm forward and up. Pain-free range.",
  "pulley assisted abduction":
    "Seated side-on to anchor. Pull good-arm cord down to raise the surgical arm out to the side. Only to comfortable height.",
  "pilates ball wall push":
    "Stand facing wall, ball at shoulder height under palm. Slow circles pressing into the ball — challenges scapular stability.",
  "pilates ball scapular squeeze":
    "Place soft ball between shoulder blades against wall. Press into ball, squeezing blades together. Hold 3–5s.",
  "overhead tricep stretch":
    "Raise one arm overhead, bend elbow so hand touches upper back. Use opposite hand to gently pull elbow across midline. Hold 20s.",

  // --- Glutes / posterior chain ---
  "single leg glute bridge with kb":
    "Lie on back, KB on hips, one foot on floor, other leg extended. Drive through heel to lift hips, squeezing glute. Lower with control.",
  "b stance kb romanian deadlift":
    "Stand with one foot staggered back, toes lightly touching floor (bearing ~20% weight). Hinge at hips lowering KB down front leg, then drive hips forward to stand.",
  "banded goblet squat":
    "Band under feet, held at chest like a goblet. Squat down keeping chest tall, drive knees out against band. Stand with glute squeeze.",
  "glute bridge":
    "Lie on back, feet flat, knees bent. Drive through heels to lift hips until body forms a line from knees to shoulders. Squeeze glutes at top, lower slowly.",
  "banded glute bridge":
    "Glute bridge with mini band above knees. Push knees apart into band through entire rep. Extra glute medius engagement.",
  "marching glute bridge":
    "From a glute bridge hold, lift one knee toward chest without dropping hips, then switch. Slow and controlled.",
  "frog pump":
    "Lie on back, soles of feet together, knees dropped out. Press feet into each other and lift hips, squeezing glutes. Short range, high reps.",
  "bridge hip abduction":
    "Hold a glute bridge at the top. Open and close knees (bands add resistance) without dropping hips.",
  "dumbbell romanian deadlift":
    "DBs in front of thighs, soft knees. Hinge at hips pushing butt back, lower weights along legs to mid-shin. Stand by driving hips forward.",
  "dumbbell single leg romanian deadlift":
    "DB in one hand. Balance on opposite leg, hinge forward as free leg extends behind you — spine neutral. Return to standing.",
  "dumbbell stiff leg deadlift":
    "Feet hip-width, knees nearly straight. Hinge at hips, DBs slide down shins, chest proud. Stand by squeezing glutes.",
  "kettlebell deadlift":
    "KB between feet. Hinge at hips, neutral spine, grip handle. Drive through heels to stand, KB stays close to body.",
  "kettlebell sumo deadlift":
    "Wide stance, KB between feet, toes slightly out. Hinge down keeping chest up, stand by driving knees out and hips forward.",
  "dumbbell deadlift":
    "DBs at sides, feet hip-width. Hinge at hips lowering weights along legs, neutral spine. Stand by pushing floor away.",
  "banded good morning":
    "Band under feet, looped across upper back. Hands holding band in place, hinge forward keeping back flat, stand by driving hips forward.",
  "banded pull through":
    "Face away from band anchor, band between legs. Hinge forward reaching band back, stand by squeezing glutes and driving hips forward.",
  "banded hip thrust":
    "Upper back on couch, band across hips, feet flat. Drive hips up, squeeze glutes at top. Lower slowly.",
  "dumbbell hip thrust":
    "Upper back on couch/bench, DB on hips. Drive hips up until body is a line from knees to shoulders. Squeeze hard, lower.",
  "kettlebell hip thrust":
    "Upper back on couch, KB on hips. Hips drive up, pause squeezing glutes, lower with control.",
  "clamshell":
    "Side-lying, knees bent 45°, feet stacked. Keep feet together, open top knee as high as possible without rotating hips back. Slow return.",
  "band clamshell":
    "Clamshell with mini band above knees. Drive top knee open against band resistance, no hip rotation.",
  "band lateral walk":
    "Band above knees, quarter squat. Step sideways keeping tension — don't let feet come together. 10 reps each direction.",
  "band monster walk":
    "Band above knees, quarter squat. Step diagonally forward alternating legs like monster stomping. Small steps, constant tension.",
  "band standing hip abduction":
    "Anchor band low, loop around outside ankle. Stand tall and kick leg out to side against band. Slow return.",
  "band kickback":
    "Anchor band low in front, loop around ankle. Hinge forward slightly, kick leg straight back squeezing glute. Control return.",
  "donkey kick":
    "On hands and knees. Drive one heel up toward ceiling keeping knee bent 90°. Squeeze glute at top, no low back arch.",
  "fire hydrant":
    "On hands and knees. Lift knee out to side (like a dog at a hydrant), keeping 90° knee bend and hips square.",
  "nordic hamstring curl assisted":
    "Kneel on pad, ankles anchored (couch/partner). Slowly lower torso forward under control using hamstrings. Catch with hands at bottom.",

  // --- Squat family ---
  "dumbbell walking lunge":
    "DBs at sides. Step forward, lower until back knee hovers above floor, drive through front heel to step into next lunge.",
  "dumbbell step up":
    "Step box or bench, DBs at sides. Place one foot on box, drive through heel to stand on top. Step down with control.",
  "bodyweight squat":
    "Feet shoulder-width, toes slightly out. Hips back and down, knees tracking toes, chest tall. Stand by pushing floor away.",
  "pulse squat":
    "Descend into squat, then 'pulse' in the bottom quarter-range a few times before standing fully. Keeps tension on quads.",
  "tempo squat 5s down":
    "Lower into squat over a 5-second count, pause 1s at bottom, stand normally. Builds control and strength.",
  "sumo squat":
    "Wide stance, toes out 45°. Squat straight down (knees track toes), stand by driving knees out and hips forward.",
  "narrow stance squat":
    "Feet closer than hip-width. Squat straight down, knees travel forward over toes. Extra quad emphasis.",
  "heel elevated squat":
    "Stand with heels on 1–2 inch elevation (plates/wedge). Squat keeping torso upright — drives quad stretch and emphasis.",
  "cyclist squat":
    "Heels elevated, feet close. Squat deep keeping torso nearly vertical. All quads.",
  "wall sit":
    "Lean against wall, slide down until knees are 90°. Hold position with weight in heels. Breathe.",
  "wall sit with tempo":
    "Wall sit, then alternately lift one heel or extend one leg straight. Keep hips level.",
  "jump squat":
    "Squat down, then explosively jump. Land soft into next squat. Arms swing for momentum.",
  "dumbbell goblet squat":
    "Hold DB at chest like a goblet. Squat keeping elbows inside knees, drive out of bottom through heels.",
  "kettlebell goblet squat":
    "KB at chest. Sit between hips, elbows inside knees, stand by pushing floor away.",
  "kettlebell front rack squat":
    "KB in front rack (elbow up, bell behind wrist). Squat keeping elbow high. Single-arm loads core asymmetrically.",
  "kettlebell sumo squat":
    "Wide stance, KB hanging between legs or at chest. Squat deep, stand by driving knees out.",
  "bulgarian split squat":
    "Rear foot elevated on couch/bench, front foot 2–3 ft forward. Lower back knee toward floor, drive through front heel.",
  "dumbbell bulgarian split squat":
    "Bulgarian split squat holding DBs at sides. Most weight on the front leg.",
  "kettlebell bulgarian split squat":
    "KB goblet at chest OR one KB racked. Split squat focusing on the front leg.",
  "reverse lunge":
    "Stand tall. Step one foot back and lower into lunge, back knee just above floor. Push through front heel to return.",
  "forward lunge":
    "Step forward into lunge, lower back knee toward floor, push back to standing.",
  "lateral lunge":
    "Wide sideways step into a single-leg squat on the stepping leg. Other leg straight. Drive back to center.",
  "curtsy lunge":
    "Step one foot behind and across the other, lowering into lunge. Drive back to standing.",
  "cossack squat":
    "Wide stance, shift weight to one side squatting deep (other leg straight, toe up). Flow side-to-side.",
  "kettlebell cossack squat":
    "Cossack squat holding KB at chest for counterbalance.",
  "dumbbell reverse lunge":
    "Reverse lunge with DBs at sides. Lower straight down, drive through front heel.",
  "dumbbell lateral lunge":
    "Lateral lunge with DBs at sides or goblet. Hip-dominant — push back as you descend.",
  "dumbbell curtsy lunge":
    "Curtsy lunge with DBs. Great for glute medius.",
  "pistol squat":
    "Single-leg squat, non-working leg extended forward. Sit back into heel, rise under control. Use TRX/pole for assist.",
  "shrimp squat":
    "Single-leg squat, rear knee bending to touch floor. Hold rear ankle with same-side hand. Advanced quad/glute.",
  "box step up":
    "Step on a stable box/bench. Drive through heel to stand fully on top. Lower with control.",
  "broad jump":
    "Stand, load hips, swing arms, jump forward as far as possible. Land soft in athletic stance.",
  "skater jump":
    "Bound laterally from one leg to the other, landing soft and balanced. Swing arms for momentum.",
  "lateral bound":
    "Push off outside leg explosively to the other side, sticking the landing on the opposite foot.",
  "split squat jump":
    "From split squat, explosively jump up, switching legs in the air. Land soft back into split squat.",
  "tuck jump":
    "Jump straight up driving knees toward chest at peak. Land soft, immediate next rep.",

  // --- Calves / ankle ---
  "single leg calf raise":
    "Balance on ball of one foot (hold wall for balance). Rise onto toes, lower with control.",
  "dumbbell calf raise":
    "Hold DBs at sides. Rise onto toes, pause squeezing calf, lower slowly. Can elevate toes on a plate for extra range.",
  "seated calf raise db on knee":
    "Sit with DB balanced on knee, ball of foot on a book/step. Raise heel through full range.",
  "tibialis raise wall":
    "Back against wall, heels ~6in from wall. Lift toes up as high as possible, hold, lower slowly. Front-of-shin work.",

  // --- Chest / press ---
  "dumbbell floor press":
    "Lie on back with DBs at chest, elbows on floor. Press up, lock out, lower until triceps lightly touch floor. Floor limits range — shoulder-safe.",
  "kettlebell floor press":
    "Lie on back, KB at chest (bell behind wrist). Press up, lower until tricep kisses floor. Pause, press.",
  "kettlebell bottoms up floor press":
    "KB held upside down (bell above hand). Floor press — grip and shoulder stability demand is huge. Stay light.",
  "single arm dumbbell floor press":
    "One DB, press up with single arm. Core braces hard to prevent rotation. Great anti-rotation work.",
  "dumbbell squeeze press":
    "Two DBs pressed together at chest, palms facing each other. Press up keeping DBs crushed together the whole time.",
  "push up":
    "Plank position, hands under shoulders. Lower until chest is a fist's height from floor, elbows at 45°. Push up without flaring.",
  "incline push up":
    "Hands on couch/bench, feet on floor. Easier version — same mechanics but less load. Great for high reps.",
  "decline push up":
    "Feet elevated on couch/bench, hands on floor. Harder — more load on chest and shoulders. Warm up the shoulder first.",
  "diamond push up":
    "Push up with hands close, index fingers and thumbs forming a diamond. Heavy tricep emphasis. Keep elbows tracking along ribs.",
  "close grip push up":
    "Push up with hands just inside shoulder-width. Tricep-biased.",
  "wide push up":
    "Push up with hands wider than shoulders. Chest emphasis. Don't go so wide you strain shoulder.",
  "tempo push up 3s down":
    "Push up with a 3-second controlled descent, pause 1s at bottom, push up normally. Builds control.",
  "pseudo planche push up":
    "Hands under hips (not shoulders), fingers pointing back. Lean forward as you lower. Huge serratus and front delt work.",
  "spider man push up":
    "As you lower into push up, draw one knee toward the same-side elbow. Alternate sides.",
  "shoulder tap push up":
    "From top of push up, tap opposite shoulder with one hand without tipping hips. Alternate. Works anti-rotation.",
  "band resisted push up":
    "Band looped across upper back, ends under hands. Push up against band resistance — accommodating resistance at lockout.",
  "banded floor press":
    "Band anchored behind you, handles in each hand at shoulders. Press forward and slightly up until arms extended. Slow return.",
  "standing band chest press":
    "Band anchored at chest height behind you. Stagger stance, press forward keeping elbows slightly below shoulder level.",
  "band incline chest press":
    "Band anchored low behind you. Press up and forward at incline angle. Upper chest emphasis.",
  "band decline chest press":
    "Band anchored high behind you. Press down and forward. Lower chest emphasis.",
  "single arm band chest press":
    "Band anchored behind, single handle. Press forward resisting rotation. Core must brace.",
  "band chest fly shallow range":
    "Band anchored behind, arms out like T. Bring hands together in front of chest — STOP before arms go behind body line. Protects shoulder.",
  "band low to high fly shallow range":
    "Band anchored low behind. Fly hands from hip level up to chest level — shallow range only.",

  // --- Back / pull ---
  "band lat pulldown kneeling":
    "Band anchored overhead, kneel facing it, hands overhead. Pull hands down to shoulders, elbows drive down and back.",
  "single arm band lat pulldown":
    "Band overhead, single hand. Pull elbow down and back to ribs, squeeze lat. Slow return.",
  "band straight arm pulldown":
    "Band overhead, arms straight in front. Without bending elbows, pull arms down to thighs by driving lats.",
  "band bent over row":
    "Stand on band, hinge forward with flat back. Row handles to ribs, elbows close. Lower with control.",
  "band seated row":
    "Band anchored at chest height, sit with feet against wall. Row handles to ribs, squeeze shoulder blades.",
  "band single arm row":
    "Band anchored at chest height. Row one handle to ribs, elbow drives back. Anti-rotation for the core.",
  "band chest supported row":
    "Lie face-down on incline bench or pillows, band under bench. Row straight up to ribs. Takes lower back out.",
  "band face pull":
    "Band anchored at face height. Pull band toward face, elbows high, splitting the band apart. Rear delts + rotator cuff.",
  "band high row":
    "Band anchored overhead. Pull handles toward upper chest, elbows high. Upper back emphasis.",
  "band reverse fly":
    "Band anchored chest-height in front, arms crossed. Pull arms apart squeezing shoulder blades together. Straight arms.",
  "dumbbell bent over row":
    "Hinge forward with flat back, DBs hanging. Row both DBs to ribs, elbows close. Control down.",
  "dumbbell single arm row":
    "Knee and hand on couch/bench, other hand holding DB. Row DB to ribs, elbow drives past torso. Slow lower.",
  "dumbbell chest supported row":
    "Lie face-down on incline or pile of pillows, DBs hanging. Row up to ribs, pause, lower.",
  "dumbbell shrug":
    "DBs at sides. Shrug shoulders straight up toward ears (not forward). Hold 1s, lower slowly.",
  "kettlebell single arm row":
    "KB in one hand, hinge over. Row KB to hip, elbow close. Great unilateral lat work.",
  "kettlebell renegade row":
    "Plank on two KBs. Row one KB to ribs while bracing hard not to rotate. Alternate.",
  "dumbbell renegade row":
    "Plank on two DBs. Row one DB to ribs, anti-rotation. Alternate.",
  "inverted row under table":
    "Lie under a sturdy table, grip edge overhead. Body straight, pull chest to table edge. Legs straight = harder, bent = easier.",
  "scapular retraction hold":
    "From a row position (band or DB), pull to ribs and HOLD for 2–3s squeezing shoulder blades. Builds mid-back endurance.",
  "prone swimmer":
    "Lie face down, arms extended overhead. Sweep arms down to sides, squeezing upper back. Reverse. Controlled.",
  "superman hold":
    "Lie face-down. Lift arms, chest, and legs off floor, holding 3–5s. Squeeze glutes and upper back.",

  // --- Shoulders ---
  "dumbbell lateral raise":
    "DBs at sides. Raise arms out to shoulder height, pinky slightly higher than thumb. Slow lower.",
  "dumbbell front raise":
    "DBs in front of thighs. Raise one arm (or both) to shoulder height, palm down. Lower controlled.",
  "dumbbell scaption raise":
    "Same as lateral raise but raise arms in the scapular plane — 30° in front of body. Thumbs up. Shoulder-friendly angle.",
  "dumbbell rear delt fly":
    "Hinge forward flat back, DBs hanging. Raise arms out to sides, squeezing rear delts. Pinkies up.",
  "dumbbell half kneeling press":
    "Half-kneeling (one knee down). Press DB overhead keeping core braced and ribs down.",
  "dumbbell single arm shoulder press":
    "Stand or seated. Press one DB overhead. Brace core to prevent side lean.",
  "dumbbell z press seated floor":
    "Sit on floor, legs extended, torso upright. Press DBs overhead — no back support means core/posture work hard.",
  "dumbbell cuban press light":
    "DBs at sides — row elbows up to shoulder height, rotate forearms up, press overhead. Reverse. Light only.",
  "dumbbell arnold press neutral to neutral":
    "Start with DBs at shoulders, palms facing you. Press overhead rotating palms slightly — stop before reaching full external rotation. Shoulder-friendlier.",
  "kettlebell halo":
    "Hold KB at chest. Slowly circle it around the head (close to you), alternating directions. Great warm-up.",
  "kettlebell bottoms up press":
    "KB upside down (bell above hand), press overhead. Grip strength + shoulder stability demand. Stay light.",
  "kettlebell half kneeling press":
    "Half-kneeling position, KB in rack. Press overhead, lower to rack. Core braces hard.",
  "band lateral raise":
    "Stand on band, handles at sides. Raise arms out to shoulder height against band. Pinky higher than thumb.",
  "band front raise":
    "Stand on band, handles in front. Raise to shoulder height, palm down.",
  "band rear delt fly":
    "Band anchored chest-height in front. Arms crossed, pull apart squeezing shoulder blades. Straight arms.",
  "band scaption raise":
    "Stand on band, handles at sides. Raise arms at 30° in front of body, thumbs up. Shoulder-safe angle.",
  "band overhead press neutral grip":
    "Stand on band, handles at shoulders, palms facing. Press overhead keeping a neutral grip throughout.",
  "band face pull with external rotation":
    "Band at face height. Pull toward face, then rotate forearms up (like a 'field goal'). Rear delts + rotator cuff combo.",
  "prone y raise":
    "Face-down, arms overhead in a Y. Lift arms off floor by squeezing lower traps. Thumbs up.",
  "prone t raise":
    "Face-down, arms out to sides in a T. Lift by squeezing mid-traps and rear delts. Pinkies up.",
  "prone i raise":
    "Face-down, arms overhead in line with body. Lift arms off floor — full lat + lower trap activation.",
  "prone w raise":
    "Face-down, elbows bent in a W. Lift arms off floor squeezing shoulder blades down and together.",

  // --- Biceps ---
  "double arm dumbbell curl":
    "DBs at sides, palms forward. Curl both up to shoulders, elbows glued to ribs. Lower slowly.",
  "seated hammer curl":
    "Seated on couch/bench. DBs at sides, palms facing each other. Curl up keeping wrists neutral.",
  "dumbbell hammer curl":
    "Standing, palms facing each other throughout. Curl up, squeeze, lower slowly. Brachialis emphasis.",
  "dumbbell zottman curl":
    "Curl DBs up with palms up. At top, rotate to palms-down. Lower in reverse grip. Forearms get smoked.",
  "dumbbell concentration curl":
    "Seated, elbow braced against inside of thigh. Curl DB up with focus on squeezing bicep.",
  "dumbbell cross body hammer curl":
    "Standing, palms facing each other. Curl DB across body toward opposite shoulder. Alternate.",
  "dumbbell reverse curl":
    "DBs at thighs, palms down. Curl up keeping palms down throughout. Forearms + brachialis.",
  "dumbbell incline curl":
    "Lean back on incline bench/couch. Let DBs hang fully — big stretch on bicep. Curl up, lower slowly.",
  "dumbbell spider curl":
    "Lie chest-down on incline bench. Arms hang straight down. Curl up to 90°, squeeze, lower.",
  "dumbbell drag curl":
    "Elbows drive back as you curl so DBs literally drag up your body. Keeps tension on biceps, less on front delts.",
  "dumbbell 21s":
    "7 reps bottom-half (thighs to 90°), 7 reps top-half (90° to shoulders), 7 full-range reps. No rest between.",
  "kettlebell bicep curl":
    "KB in each hand or one two-handed. Curl up palms-up, squeeze, lower.",
  "kettlebell bottoms up curl":
    "Curl KB with bell pointing up (bottom-up). Huge grip/forearm demand.",
  "band bicep curl":
    "Stand on band, curl handles up to shoulders. Constant tension through whole range.",
  "band hammer curl":
    "Stand on band, palms facing each other. Curl up.",
  "band concentration curl":
    "Sit on edge, anchor band under foot, elbow against inner thigh. Curl up slowly.",
  "band preacher curl over couch arm":
    "Drape arm over padded couch arm, band anchored low under foot. Curl up — preacher bench simulation.",
  "band 21s":
    "21s with band for constant tension — 7 bottom, 7 top, 7 full.",

  // --- Triceps ---
  "dumbbell overhead tricep extension":
    "Hold one DB with both hands overhead. Lower behind head by bending elbows only. Press back up. Elbows stay narrow.",
  "dumbbell single arm overhead tricep extension":
    "One DB overhead. Lower behind head, press up. Elbow points to ceiling.",
  "dumbbell tricep kickback":
    "Hinge forward with flat back, DB in one hand, elbow at rib height. Extend forearm straight back until locked out. Squeeze.",
  "dumbbell floor skull crusher":
    "Lie on floor, DBs pressed up. Bend elbows to lower DBs toward ears/forehead. Extend back up.",
  "dumbbell close grip floor press":
    "Lie on floor, DBs pressed together. Lower DBs keeping elbows tight to ribs until triceps touch floor. Press up.",
  "dumbbell tate press":
    "Lie on back, DBs pressed up. Lower by bending elbows out to sides (DBs move toward center of chest). Extend back up.",
  "kettlebell overhead tricep extension":
    "KB held with both hands overhead. Lower behind head, press up.",
  "band tricep kickback":
    "Band anchored at waist height in front. Hinge forward, elbows at ribs, extend forearms straight back against band.",
  "band overhead tricep extension":
    "Band anchored low behind. Hands overhead holding ends. Lower behind head, press up.",
  "band single arm tricep extension":
    "Anchor band overhead. One hand reaches up and presses down/back to extend triceps.",
  "band tricep pushdown":
    "Band anchored high. Elbows at ribs, press handles down until arms locked. Slow return.",
  "band rope pushdown":
    "Same as tricep pushdown but split handles apart at bottom for extra long-head stretch.",
  "bench dips":
    "Hands on edge of bench/couch behind you, legs extended forward. Lower hips by bending elbows, push back up. Elbows track back, not flare.",
  "one arm lying triceps extension":
    "Lie on back, one DB held overhead. Lower weight toward same-side ear, press back up.",

  // --- Olympic / power (included but shoulder-aware) ---
  "barbell jump squat":
    "Light bar on back, squat then jump explosively. Land soft. Power/speed work.",
  "landmine squat to press":
    "Front squat with landmine at chest. Stand, then press landmine up and out. Shoulder-friendly pressing angle.",
  "dumbbell devil press":
    "DBs to floor in burpee. Jump feet back, push up, return, explosively swing DBs from floor overhead. Huge conditioning.",
  "backward medicine ball throw":
    "Hold med ball at chest. Squat down, then explosively stand and throw ball overhead behind you.",
  "kettlebell swings":
    "Hinge hard, KB swings between legs then snaps to chest height driven by hip extension. Arms are ropes.",
  "power clean":
    "Deadlift bar to mid-thigh, explosive triple extension, pull under to catch in front rack.",
  "barbell snatch":
    "Deadlift bar, explosive triple extension, pull under to catch overhead arms locked.",
  "push press":
    "Front rack, dip knees slightly, then drive up explosively using legs to press bar overhead. Warm up shoulder first.",
  "push up toe touch":
    "Push up, then at top kick one foot up and reach across with opposite hand to touch it. Alternate.",
  "one leg push up":
    "Push up with one leg lifted off floor throughout. Extra core and stability.",
  "human flag":
    "Grip a vertical pole, top hand overhead, bottom hand near hip. Hold body horizontal off the pole. Advanced.",

  // --- Core ---
  "ab roller crunch":
    "Lie on back, ab roller behind head for lumbar support. Crunch up lifting shoulder blades, lower slowly.",
  "barbell rollout ab roller":
    "Kneel with ab wheel or barbell. Roll forward extending body, stop before lower back sags. Pull back to start.",
  "bird dog":
    "On hands and knees. Extend opposite arm and leg, hold 2s, return. Keep hips square, don't rotate.",
  "dead bug":
    "Lie on back, arms up and knees at 90°. Extend opposite arm and leg, low back stays pressed to floor. Return, alternate.",
  "mountain climber":
    "Plank. Drive knees alternately toward chest fast. Hips stay low, don't bounce.",
  "cross body mountain climber":
    "Mountain climber but knee drives to opposite elbow. Adds rotation.",
  "bicycle crunch":
    "Lie on back, hands behind head. Bring opposite elbow to opposite knee while extending other leg. Alternate.",
  "side plank rotation":
    "Side plank with top arm reaching toward ceiling. Rotate top arm under torso, then back up. Be gentle — shoulder-intensive.",
  "hollow hold":
    "Lie on back, arms overhead, legs straight. Press low back into floor, lift shoulders and legs — banana shape. Hold.",
  "hollow rock":
    "From hollow hold, rock slowly head-to-heels, maintaining tight hollow shape.",
  "v up":
    "Lie flat, arms overhead. Simultaneously lift straight legs and torso to touch hands to feet. Lower slowly.",
  "tuck up":
    "Lie flat. Sit up while tucking knees to chest, hands reaching outside knees.",
  "toe touches":
    "Lie on back, legs straight up. Crunch up reaching fingertips toward toes. Lower shoulder blades to floor.",
  "jackknife":
    "Lie flat, arms overhead. Lift arms and legs meeting in middle (pike position).",
  "russian twist":
    "Seated, knees bent, torso leaned back. Rotate side to side tapping floor with hands.",
  "weighted russian twist":
    "Russian twist holding a DB/KB at chest. Rotate fully each side.",
  "sit up":
    "Lie flat, knees bent. Sit up touching chest toward knees. Control the descent.",
  "weighted sit up":
    "Sit up holding DB/plate at chest or overhead.",
  "reverse crunch":
    "Lie flat, legs up. Lift hips off floor by curling pelvis toward ribs (not pulling with legs).",
  "lying leg raise":
    "Lie flat, hands under hips. Raise straight legs to vertical, lower slowly without letting heels touch floor.",
  "flutter kick":
    "Lie flat, legs straight and slightly off floor. Small rapid up-down kicks. Low back stays pressed down.",
  "scissor kick":
    "Lie flat, legs straight off floor. Cross-scissor legs over and under each other.",
  "heel tap":
    "Lie on back, knees bent. Alternately reach one hand to tap same-side heel. Lifts obliques.",
  "forearm plank":
    "Forearms and toes on floor, body in a straight line. Squeeze glutes, brace core. Don't let hips sag.",
  "rkc plank full body tension":
    "Forearm plank, but CRUSH your fists, squeeze glutes hard, brace abs like bracing for a punch. 20s feels like 60.",
  "side plank left":
    "Lie on left side, forearm down, hips stacked. Lift hips until body is a straight line. Hold.",
  "side plank right":
    "Lie on right side, forearm down, hips stacked. Lift hips until body is a straight line. Hold.",
  "side plank hip dip":
    "From side plank, dip hip to floor, then lift back up above neutral. Obliques work.",
  "plank shoulder tap":
    "From plank, alternately tap opposite shoulder. Don't rotate hips. Anti-rotation.",
  "plank to push up":
    "Forearm plank. Push up one arm at a time to high plank, then back down to forearms. Alternate leading arm.",
  "copenhagen plank":
    "Side plank with top leg on couch/bench. Squeeze top thigh into surface. Groin/adductor work.",
  "band pallof press":
    "Band anchored at chest height to your side. Hold at chest with both hands. Press straight out — band pulls you sideways. Resist rotation.",
  "band pallof hold":
    "Pallof press position, arms extended. HOLD against rotational pull for 10–15s per side.",
  "band woodchop high to low":
    "Band anchored high. Two-handed pull diagonally across body to opposite hip — rotate through torso.",
  "band reverse woodchop low to high":
    "Band anchored low. Two-handed pull diagonally from hip to opposite shoulder overhead.",
  "band standing crunch":
    "Band anchored overhead, handles at shoulders. Crunch forward by pulling elbows toward hips.",
  "stir the pot forearms on ball":
    "Forearm plank on a pilates ball. Make slow circles with forearms. Massive core demand.",
  "dead bug with band":
    "Dead bug holding a band anchored overhead with straight arms. Band pulls arms up — resist while moving legs.",
  "pilates ball dead bug":
    "Dead bug holding pilates ball between opposite hand and knee. Maintain ball pressure as you extend.",
  "suitcase carry":
    "Walk holding a single DB/KB in one hand. Don't lean. Core braces hard anti-lateral-flexion.",
  "farmer carry":
    "Walk holding heavy DBs/KBs in both hands. Tall posture, short ribs, full exhale between steps.",
  "l sit hold":
    "Sit on floor or parallettes, legs extended in front parallel to floor. Hold. Hip flexor + ab endurance.",
  "hollow to arch transition":
    "Hollow hold → roll over → arch hold (superman) → roll back. Full-body tension drill.",
  "captains chair leg raise":
    "Suspended in captain's chair (or hang from bar). Raise knees toward chest, lower slowly.",

  // --- Full body / conditioning ---
  "bear crawl":
    "On hands and balls of feet, knees hover 1 inch off floor. Crawl forward moving opposite hand/foot. Hips stay low.",
  "crab walk":
    "Sit, hands behind, hips up like reverse table. Walk in any direction. Great for shoulder/tricep endurance.",
  "inchworm no push up":
    "Stand, hinge to touch floor, walk hands out to plank, walk feet up to hands, stand. Repeat.",
  "kettlebell turkish half get up":
    "Lie with one KB pressed up. Roll to elbow, then to hand. Reverse. Halfway of full get-up.",
  "kettlebell turkish get up":
    "From supine KB press: roll to elbow → hand → lift hips → sweep leg under → lunge up → stand. Reverse. Shoulder stability gold.",
  "dumbbell thruster warm up first":
    "DBs at shoulders. Full squat, then drive up and press overhead in one motion. Shoulder must be warm.",
  "burpee no push up":
    "Squat, hands to floor, jump feet back to plank, jump feet forward, stand and jump. No push-up — shoulder-friendly.",
  "kettlebell clean neutral rack":
    "KB between feet. Pull upward, catch KB in front rack (handle under wrist, bell resting on forearm). Keep elbow tucked.",
  "kettlebell squat to press":
    "KB in rack or at chest. Squat, then stand and press overhead. Fluid motion. Warm up shoulder.",
  "kettlebell farmer walk":
    "Walk holding KB in each hand. Tall posture, braced core. 30–60s carries.",
  "burpees":
    "Squat, plank, push up (or not), jump feet forward, explosive jump up. Repeat.",

  // --- Cardio ---
  "bike":
    "Stationary bike or outdoor. Maintain target HR or effort. Seated for steady state, standing for intervals.",
  "jump rope":
    "Turn rope with wrists, small hop off balls of feet. Build rhythm — doubles, singles, alternating feet.",
  "running":
    "Run at prescribed pace. Quick turnover, tall posture, relaxed shoulders. Hydrate before.",
  "hike":
    "Walk on varied terrain. Use hiking poles on downhills to protect knees. Cardio + nature reset.",
  "ski ergometer":
    "SkiErg machine. Hinge at hips, pull handles down and back driven by lats and core. Rotate handles slightly.",

  // --- Mobility / yoga / stretches ---
  "cat cow pose":
    "On hands and knees. Inhale: drop belly, lift chest (cow). Exhale: round spine, tuck chin (cat). Flow with breath.",
  "cross body shoulder stretch":
    "Pull one arm across chest with other hand at elbow (not wrist). Hold 20–30s each side.",
  "figure four glute stretch":
    "Lie on back. Cross right ankle over left knee, pull left thigh toward chest. Hold 30s. Switch.",
  "doorway chest stretch":
    "Stand in doorway, forearms on frame, elbows at 90°. Step one foot forward, lean through. Hold 20–30s.",
  "childs pose":
    "Kneel, sit hips back to heels, arms extended forward on floor. Forehead down. Breathe.",
  "standing hamstring stretch":
    "Stand, one foot on low step or chair, leg straight. Hinge forward from hips (not round back). Hold.",
  "kneeling hip flexor stretch":
    "Half-kneeling, squeeze back glute, tuck pelvis slightly. Shift weight forward until stretch felt in front of hip.",
  "standing quad stretch":
    "Stand on one leg, pull other heel toward glute. Tuck pelvis for deeper stretch. Hold 30s.",
  "bhujangasana cobra abdominal stretch":
    "Lie face-down, hands under shoulders. Press up, lifting chest, elbows soft. Squeeze glutes, relax neck.",
  "ustrasana":
    "Kneel, hips forward, reach hands back to heels. Chest up and open. Deep front-body stretch.",
  "utthita trikonasana extended triangle pose":
    "Wide stance, front foot turned out. Hinge to place hand on shin/floor, other arm reaches to ceiling. Open chest.",
  "tiger yoga pose":
    "Hands and knees. Extend opposite arm and leg like bird dog but arched. Flow between curl-and-extend.",
  "ardha kapotasana half pigeon pose":
    "From plank, bring one shin under body parallel to mat, other leg extended behind. Sink hips. Glute stretch.",
  "warrior pose":
    "Wide stance, front knee bent 90°, back leg straight. Arms extended. Strong posture, hips square.",
  "camel pose":
    "Kneel, tops of feet down, hands to heels. Press hips forward, arch back. Shoulder-safe version: hands on low back.",
  "titli asana butterfly pose":
    "Seated, soles of feet together, knees wide. Gently press knees toward floor. Hip/groin opener.",
  "upavistha konasana":
    "Seated, legs wide. Hinge forward from hips, walk hands forward. Hamstrings and adductors.",
  "nauka sanchalanasan rowing the boat pose":
    "Seated, legs extended. Flow torso through a rowing motion — reach forward, pull back. Mobility + warm-up.",
  "adho mukha svanasana downward facing dog":
    "Hands and feet on floor, hips high forming inverted V. Press chest toward thighs. Ease shoulders — short dog is OK post-Latarjet.",
  "halasana plow pose":
    "Lie on back, roll legs overhead until toes touch floor behind head. Hands on lower back for support. Keep weight off neck.",
  "malasana squat pose or garland pose":
    "Deep squat, feet flat, knees out. Elbows inside knees, hands at heart. Hip opener.",
  "locust pose":
    "Lie face-down. Lift chest, arms, and legs off floor simultaneously. Hold 10–20s. Posterior chain.",
  "shoulderstand salamba sarvangasana":
    "Lie on back, support hips with hands, legs extend to ceiling. Weight on shoulders — NOT neck. Use folded blanket.",
  "balasana child pose":
    "Kneel, sit back on heels, fold forward with arms extended. Forehead to floor. Rest pose.",

  // --- Stretches added in home catalog ---
  "90 90 hip stretch":
    "Seated with one leg 90° in front, other 90° to side. Lean forward over front leg. Switch sides.",
  "couch stretch":
    "Kneel, one shin vertical against wall/couch (knee on floor), other foot forward. Squeeze back glute. Intense hip flexor stretch.",
  "worlds greatest stretch":
    "Lunge with hand on floor inside front foot. Reach other arm to ceiling rotating through torso. Step through.",
  "quadruped t spine rotation":
    "Hands and knees, one hand behind head. Rotate elbow up toward ceiling, then thread across and down. Alternate.",
  "thread the needle":
    "On hands and knees. Slide one arm under the other, palm up, chest turns down. Gentle t-spine/shoulder stretch.",
  "wall angel":
    "Back and arms flat against wall, arms in 'W'. Slide arms overhead keeping everything touching wall. Lower.",
  "spiderman lunge with rotation":
    "Lunge forward, same-side hand to floor inside foot. Rotate other arm to ceiling. Step through.",
  "frog stretch":
    "On hands and knees, knees wide, ankles in line with knees, feet flexed. Sit hips back slowly. Adductor opener.",
  "seal stretch":
    "Lie face-down, press chest up with hands, hips stay on floor. Cobra-like. Spine extension.",
  "calf stretch at wall":
    "Stand facing wall, one foot forward (bent), one back (straight, heel down). Lean into wall. Stretches back-leg calf.",
  "hamstring floss":
    "Lie on back, loop band or towel around ball of foot. Alternately straighten knee and flex ankle — dynamic 'flossing'.",

  // --- Foam rolling variants ---
  "foam roll quads":
    "Face-down on roller, weight on quads. Roll slowly from hip to just above knee. Pause on tight spots.",
  "foam roll it band":
    "Side-lying with roller on outside of thigh. Roll slowly from hip to just above knee. NOT on the joint.",
  "foam roll hamstrings":
    "Seated with roller under hamstrings, hands behind for support. Roll from glutes to just above knees.",
  "foam roll lats careful":
    "Side-lying, roller under upper lat, arm extended overhead. Roll gently — avoid shoulder joint post-Latarjet.",
  "foam roll upper back":
    "Lie back on roller, cross arms over chest. Lift hips slightly and roll from mid-back to upper back (not lower back).",
  "foam roll pecs":
    "Face-down on roller placed diagonally under one pec. Stay there, let pec release. Sweep small arm circles.",

  // --- Banded stretches ---
  "banded hip flexor stretch":
    "Band anchored low in front. Loop around top of one thigh, step back into half-kneel. Band pulls hip back as you squeeze glute.",
  "banded hamstring stretch":
    "Lie on back, loop band around ball of foot. Straighten leg toward ceiling, pull gently with band. Switch.",
  "banded shoulder distraction":
    "Band anchored overhead. Step into loop with wrist. Walk back until band pulls arm up — gentle joint traction.",
  "banded sleeper stretch":
    "Side-lying. Top arm elbow at 90°, forearm slowly presses toward floor. STOP at first resistance post-Latarjet.",
};

/**
 * Look up instructions for an exercise name. Returns undefined if no match.
 * Matching is substring-based on normalized names — same pattern as exerciseGifs.
 */
export function findInstructionsForName(name: string): string | undefined {
  const n = normalize(name);
  if (INSTRUCTIONS[n]) return INSTRUCTIONS[n];
  // Fall back: try to find any key that is a substring of the name, or vice versa.
  for (const key of Object.keys(INSTRUCTIONS)) {
    if (!INSTRUCTIONS[key]) continue;
    if (n.includes(key) || key.includes(n)) return INSTRUCTIONS[key];
  }
  return undefined;
}

export const INSTRUCTION_COUNT = Object.values(INSTRUCTIONS).filter(Boolean).length;
