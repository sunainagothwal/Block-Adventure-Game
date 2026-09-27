# Block Adventure

**Match. Blast. Solve. Explore.**

Drag blocks onto the 8×8 grid. Fill a whole row or column and it blasts. That
is the entire rule — everything else is the adventure built on top of it.

Runs in **stock Expo Go on Android**. No Android Studio, no custom native
modules, no dev client.

---

## Run it

```bash
npm install
npx expo start
```

Scan the QR with Expo Go (Android), or press `a` for a connected device.

Verified against **Expo SDK 57** (React Native 0.86, React 19.2). `npm run typecheck`
is clean and `npx expo export --platform android` bundles without warnings.

---

## The loop

```
Welcome → Play → Puzzle → Clear Lines → Score/Combo → Complete Objective
   → Earn Stars/Coins → Rewards → Unlock Level → Adventure Progress → Repeat
```

- **Welcome page** — a fantasy sky scene: floating islands with waterfalls, a
  castle, a stone platform in the water, and the logo above a pyramid of
  symbol blocks (circle, clover, diamond, triangle, star). PLAY and HOW TO PLAY
  sit below; sound, music and settings are the three corner buttons. See
  *The welcome scene* below.
- **Three tabs** — Home, Adventure, Rewards (the reference's bottom bar).
- **Home** — the game logo over a "World N" card with the level you are up to,
  its goal, moves, and PLAY NOW; below it, tiles for the Daily Reward (with a
  red dot when one is waiting) and the Treasure Chest (keys / 5). Settings is the
  corner gear.
- **Adventure** — the world map: one world at a time on a winding path, with a
  themed scene behind it (Green Forest, Sunny Beach, Snowy Peaks, Desert Dunes,
  Night Sky), blue numbered nodes with 1–3 stars, a gold pulsing current level,
  and grey locks. Arrows in the header switch worlds; the map scrolls.
- **Rewards** — one screen, no scrolling: the wooden *Daily Rewards* board (the
  7-day ladder, chests on days 3, 5 and 7, and Claim Reward). Tap the open chest
  at the bottom to reach the Treasure Chest. The board scales down to fit small
  screens.
- **Treasure Chest** — a full-screen chest with a key meter (5 keys open it).
  A key is earned for each level you clear for the first time.
- **Game screen** — pause button, level pill, coins, a goal card and a moves
  card, score bar with three star markers, the board, the tray of three blocks,
  and a labelled row of six power-ups. **Pause** offers Resume / Restart /
  Home / Settings. **Level Completed** shows three stars over a mascot block,
  coins and stars earned, score / best / lines, NEXT LEVEL, and Home / Retry /
  Map. **Game Over** offers TRY AGAIN, USE BOOSTER and Home.
- **How To Play** — a two-page illustrated card, opened from the welcome page,
  the "?" in a level, and automatically before your first level.
- **Settings** — Sound Effects, Music, Language, Vibration, Rate Us and Reset
  Progress. Rate Us needs a Google Play listing before it can do anything.

### Losing

Two ways, both of which show **GAME OVER** with **TRY AGAIN**, **USE BOOSTER**
and **HOME**:

- **Out of moves** — the goal was not reached in time.
- **No room left** — none of your three blocks fits anywhere, in any rotation.

The second is the real skill test, which is why the board highlights the line
about to blast before you commit. The fit check honours rotation, so a block
that only fits sideways still counts. **USE BOOSTER** bails you out with fresh
blocks and extra moves instead of restarting.

---

## The welcome scene

Everything is vector — no image files. The scene is drawn in a fixed
**300 × 560 "stage"** and scaled to fit, so it keeps its proportions on any
phone: a small 360 × 640, a tall 412 × 915 and a tablet all render correctly,
with the sky and water simply extending past the stage on taller screens and the
foliage anchored to the real screen corners.

- **Static art** (one memoised SVG): the sky gradient, stars, layered clouds,
  five floating islands, two waterfalls pouring off the rock, a castle, the
  water with ripples, and a stone platform with grass, bushes and flowers.
- **Symbol blocks:** glossy moulded tiles with an embossed glyph in a recessed
  panel. A same-colour stroke on each glyph rounds every corner, which is what
  makes them read as soft plastic rather than sharp vector shapes.
- **The logo** is Lilita One, built from stacked copies: a run pushed down for
  the 3D lip, eight around the glyph for the thick outline, the fill, and a
  lighter copy clipped to the top half for the gloss. Text widths were measured
  from the font file itself, so the two lines are sized from data rather than
  guessed.
- **Motion:** five blocks bob on their own rhythm, the top block floats inside a
  spinning golden orbit, sparkles twinkle, clouds drift, the PLAY button breathes
  and sweeps a shine across itself. The pyramid blocks are tappable — they
  squash and spring back with a little sound.

If the font ever fails to load the welcome page falls back to the system font
instead of blocking the game.

### How it was checked

The app was built for web and rendered in a real browser at phone, tall-phone
and tablet sizes, then compared against the reference. That caught things a
typecheck never would: the waterfalls were hidden behind the rock, the golden
ring was designed but never written, the platform was buried under the blocks,
and a castle tower was being clipped by the tagline. It also caught a bug in
the bottom nav, where the active tab's gold glow painted over its own icon —
fixed with an explicit `zIndex` so it no longer depends on platform paint order.

A browser render approximates Android closely (layout, SVG, gradients, fonts)
but is **not** pixel-identical to a device, and it has not been run on Android
hardware. Worth a look on a phone, particularly the logo's highlight split,
which depends on font metrics that differ slightly between platforms.

---

## Worlds

Five illustrated worlds, each a layered **react-native-svg** scene — no
background images anywhere. They live in `src/worlds/`, one file per world.

| World | Look | Landmark at the end of the road |
| --- | --- | --- |
| 1 Green Forest | sunny glade, river down one side, butterflies, drifting petals | log cabin with a smoking chimney |
| 2 Sunny Beach | turquoise sea along the shore and out to the horizon, gulls | striped lighthouse with light beams |
| 3 Snowy Peaks | snow-capped mountain ranges, frozen lakes with penguins, falling snow | ice palace |
| 4 Desert Dunes | rolling dunes, an oasis, cacti and mesas, a soaring hawk | a trio of pyramids |
| 5 Night Sky | twinkling stars, aurora, crescent moon, glowing crystals, fireflies, a shooting star | observatory |

**Layers, back to front:** sky gradient → sun / moon / stars → drifting clouds
and other sky life → two far ridges → *(the scrolling map starts here)* →
terrain → the curved road → scenery → level nodes → ambient motion in front
(snow, fireflies, butterflies).

**Parallax.** The sky and ridges are pinned to the screen and slide at 5–42 % of
the scroll speed, driven on the UI thread, so the world has depth as you climb.
Scenery is scaled by perspective (small near the horizon, large in front) and
painted back to front.

**The road.** Level 1 is at the bottom and the road winds *up* to the world's
landmark. Every world has its own swing and wavelength, with an extra bulge
between each pair of nodes so it meanders. The stretch you have already
travelled turns gold.

**Scenery placement** is deterministic per world and screen width: trees and
big props hug the edges, small things (mushrooms, shells, flowers) sit just off
the road, water-only things (lilies, boats, penguins) go only on water, and
nothing grows on the road or in a lake. Scenery is split into 520 px chunks,
each its own `<Svg>`, so no single native view is thousands of pixels tall.

**Interactive levels.** Tap a level and a sheet rises with its stars, the score
needed for each star, the goal, moves, your best, and PLAY (or PLAY AGAIN). A
locked level shakes, plays a soft "uh-uh" and says which level to clear first.
Cleared levels show their 1–3 stars; the current level wears a bobbing pin; the
last level of each world wears a crown. A newly unlocked level pops in with a
chime, and the first time you open a world the camera flies down from its
landmark to where you are. The header shows stars collected in the world and
five dots you can tap to jump between worlds.

What changes in the *game* from world to world is a separate matter (the scenery
is decoration; the obstacles are the design):

| Levels | What is new |
| --- | --- |
| 1–12 | Just the rule. Clear lines, then reach a score. Level 1 opens the tutorial. |
| 13–24 | **Crystals** pop when a line clears through them |
| 25–36 | **Ice** breaks when a line clears through it |
| 37–48 | **Stone** never clears, but still counts as filled |
| 49–60 | Crystals *and* ice together, on a stony board |

The first time a new obstacle appears you get a one-time card naming the
*obstacle* (Crystals, Ice, Stone), which is what you actually need to know.

Each world owns one new idea then lives with it, with relief levels sprinkled
mid-world so the curve is not a straight climb. A world never shows an obstacle
that does not matter to its goal — the headless suite asserts it.

**Adding or editing a world:** a world is a `WorldDef` (`src/worlds/types.ts`):
sky stops, sky art, far ridges, terrain, a water test, a list of scenery kinds
with weights and sizes, a landmark, ambient motion, and the road's colours and
shape. Props are drawn in a 100-unit box with their base at the origin
(`src/worlds/props.tsx`), so they can be reused across worlds.

---

## Power-ups

Owned as an inventory, bought with coins when you run out. Tapping a targeted
power arms it; the board then previews exactly which cells it will take.

| Power-up | Cost | Effect |
| --- | --- | --- |
| **Shuffle** | 60 | Swaps your three blocks |
| **Hammer** | 80 | Smash one placed block |
| **Magic Block** | 120 | Turns your biggest block into a 1×1 |
| **Rocket** | 150 | Clears a whole row *and* column |
| **Bomb** | 200 | Blasts a 3×3 |
| **Color Blast** | 250 | Clears every block of one colour |

Stone survives all of them. Every power routes through the same
`PlaceResult`, so scoring and objective progress flow through exactly one code
path no matter how a cell was removed — a rocket through a crystal collects it
just like a line clear would.

## Coins, helpers and ads

The game is free to play, and ads are the income. Coins are deliberately
**scarce**, so spending them is a decision.

**Earning coins** (all of it is small, and ads never pay coins):

- **Levels** pay only the *first* time you clear one: 3 coins per star. Replays pay nothing.
- **Daily rewards** — a 7-day ladder of 10 → 30 coins, with a free Shuffle, Hammer and Bomb on days 3, 5 and 7.
- **Treasure chest** — one key per newly-cleared level; five keys pay 25 coins and a random power-up.
- A new player starts with 40 coins and one Shuffle.

**Spending coins**

| Helper | Cost | What it does |
|---|---|---|
| Hint | 10 | Points at a good drop for one of your blocks |
| Undo | 10 | Takes back your last block, with its score and move |
| Shuffle | 15 | Swaps your three blocks (a Shuffle you were given is used first) |

A helper that cannot do anything right now (Undo with nothing to undo, Hint
with no move) costs nothing. The power-ups on the map cost 40–100 coins.

**No coins? Watch an ad.** Tapping a helper without enough coins offers one
free use in exchange for a rewarded ad. Rewarded ads are also offered on the
Game Over card to keep playing (5 extra moves and a fresh tray).

**Ad limits.** Rewarded ads are capped at **5 per day** (`DAILY_AD_LIMIT` in
`src/ads.ts`). The count is stored on the device apart from the game save, so
"Reset progress" does not refill it. When the limit is reached, the buttons
say so instead of offering an ad. Interstitials run only between levels, after
the first three, then one per three finished levels and never within two
minutes of another ad. There are no ads while a level is being played.

Set your AdMob IDs in `src/ads.ts` and `app.json`. Until then, and in every
dev build, Google's test ads are used. The ad SDK is a native module: it does
not run in Expo Go (rewarded ads are simulated there in dev).

Every claim runs the same animated popup with confetti.

---

## Visual checks, and what was caught

The screens were rendered in a real browser (react-native-web) and compared with
the reference sheet. Things this found that a typecheck could not: icons inside
panels painted *under* the panel's overlays (fixed by giving `Panel` an
explicit stacking context instead of relying on child order), the star icon
turning into a pentagon with dark blobs (its inner radius was too large and its
halo used mitred joins), and a clipped square glow behind the treasure chest.

A browser render is **not** a device. This build has been type-checked, bundled
for Android, and unit-tested for rules, but it has not been run on Android
hardware, and the display font is now applied app-wide, so text widths on a
real phone may differ slightly from the browser.

---

## Every level is tuned by simulation

The tray is random, so a level cannot be "solved" ahead of time the way a fixed
puzzle can. Instead every level is **played hundreds of times by a bot** using
the real rules engine (cut out of `App.tsx`, not a copy), and the goal is set
so the bot wins a chosen share of the time.

- **Move limit:** 30 to 40 moves, rising with the level. Crystal, ice and clear-all
  levels sit at the tight end (30 to 35), because they need *specific* lines, not just any lines.
- **The bot** plans a whole tray ahead (every order and rotation), about as well as a careful player.
- **Difficulty:** the bot wins about 90% of level 1, about 60% around levels 13 to 30, and
  30 to 50% in the last world; the share of games that dead-end climbs from ~1% to ~50%.
- **Line and score goals** are read off the bot's results, so they rise with it (10 lines at
  level 1, 16 to 18 in the fourth world).
- **Crystal and ice levels** are built around how many *separate* lines you must clear, not how
  many obstacles there are (a crowd on the same lines falls together, which is easy): one
  obstacle per row and column, up to 8 lines, then extra obstacles on those lines. Levels 13 to
  24 start at 8 or more crystals and every world starts harder than the last.
- **Re-tuning:** `node scripts/tune-levels.js --write` rebuilds `LEVEL_DATA`;
  `--check` replays the levels in `App.tsx` without changing them. The two
  numbers `WIN_FIRST` and `WIN_LAST` at the top of the script set how hard the
  game is. The bot is a greedy player, a stand-in for a competent human, so
  adjust them if real players find it too hard or too easy.

Three things the simulation caught along the way:

- **The first tuning pass was backwards** — it held the goal fixed and raised
  the move limit until the bot could win, producing 40–73 move levels and two
  score targets no bot ever reached (0% win rate). Inverting it — fix a short
  move curve, scale the goal down — gave 18–32 move levels.
- **Crystal and ice levels were failing at 16–83%.** The instinct was to
  redesign the obstacle; the actual cause was the bot never *setting up* the
  line an obstacle sat on, which is the first thing a human does.
- **Making "no fit" a loss changed every number**, since the earlier build
  silently swapped a stuck tray. The whole ladder was re-tuned against the real
  rule.

The table below is from an earlier tuning pass (18–32 move levels); the current
ladder is described above.

```
World 1   99 93 95 97 97 98 89 100 97 97 89 92
World 2   100 100 100 100 100 97 99 99 97 97 93 98
World 3   100 99 99 100 98 100 97 100 95 93 95 98
World 4   95 100 95 92 91 93 91 95 89 91 93 87
World 5   99 95 89 97 97 96 90 88 93 89 93 91
worst 87%  avg 95%  stuck avg 4%
```

That 4% stuck rate is the point: dead-ending is a live threat without being the
usual outcome, and it climbs from ~0% in the opening levels to ~15% in the
finale.

The suite also covers: placement bounds on all four sides, obstacle cells
rejected, a full row clearing, a row-plus-column counting as two lines with the
intersection resolved once, the drop preview predicting exactly what the
placement does, `anyFits()` honouring rotation, stone surviving every clear and
every power-up, each of the six power-ups (hammer refusing stone / crystal /
ice, rocket taking a full row and column, bomb clipping at corners, colour
blast touching only its own colour and never an obstacle), the scoring curve,
the coin formula, every star tier being reachable, four turns restoring every
shape variant, obstacles only appearing when they matter to the goal, and each
mechanic debuting in the right world.

---

## Art direction

**Illustrated, not photographic.**

- **Home** — the welcome scene's floating islands tinted to dusk, the tagline
  top-left, a big logo, a tall level card that fills the screen (a night-forest
  picture, "WORLD 1 / LEVEL n", the goal and moves, the block pyramid and PLAY
  NOW) and the Daily Reward and Treasure Chest tiles below it.
- **World maps** — one illustrated map per world (`MapScene`): a forest of
  outlined cartoon trees, bushes, flowers and rocks around a winding dirt path,
  with a river down the right edge. Each world swaps the theme: round trees and
  pines, palms on sand, snow-capped pines on snow, cacti on dunes, glowing
  crystals under a night sky. Trees are placed at random but never on the path,
  and the layout is seeded per world so it never reshuffles.
- **Round and square badges, stars** — [Kenney UI Pack](https://kenney.nl/assets/ui-pack)
  (CC0) in `assets/ui/`, with its licence file.
- **Display font** — Lilita One (SIL OFL).

Rectangular buttons are cut into a left cap, a stretchy middle and a right cap
(`ButtonSkin`), so a button can be any width without squashing its corners.
Every press animation, sound and haptic is unchanged; only the skin under the
label changed.

**Drawn objects.** The treasure chest, the gift box, the sun rays, the power-up
tiles and the welcome scene are vector.

**Bricks and buttons.**

Chunky candy bricks on a blue-to-violet sky.

Each brick cell is three SVG paths: a **dark rounded square underneath** as the
extruded side, a **bright gradient face** on top of it shifted up, and a
**gloss bar** across the upper third — which is what makes them read as solid
plastic rather than flat squares. Buttons and tabs use the same trick, a solid
colour drop-edge behind the face, so pressing one visibly depresses it.

The board is a grid of dark recessed sockets. Placed bricks are batched into
one path per colour, so a full board is about a dozen SVG paths rather than 64.
Every world has its own sky gradient and glow, and the backdrop follows you.

Confetti, sparkles and the blast burst are all Reanimated on the UI thread.

---

## Audio

**Every sound is original and royalty-free.** Nothing is sampled, downloaded or
licensed: the scripts in `scripts/audio/` synthesize all of it (additive
synthesis, filtered noise, a small reverb) and `scripts/make-audio.js` writes it
to `assets/audio/` (28 files, ~7 MB of WAV).

```bash
npm run audio          # re-render every sound
npm run check-audio    # structural + spectral checks on the result
```

**Music (7) — calm and low.** Each is a 12-bar loop of 37–48 s at 60–78 BPM,
built the way cozy, meditative game soundtracks are: slow tempo, melodies in the
low-middle register (about C3–C5), soft felt / wooden / breathy instruments, every
melodic layer low-passed so almost nothing sits above 2 kHz, long sparse notes
rather than busy runs, few chord changes, and **no drums** — a low
thump just reads as a dull "doom" on a phone speaker. Each tune is a short motif
that the second phrase repeats note for note, so it is recognisable. There is one for the menus, one for the puzzle board, and one per
world:

| Track | Where | Key / tempo | Voices |
| --- | --- | --- | --- |
| `music_menu` | welcome, home, rewards | C, 66 | felt piano over a low marimba arpeggio |
| `music_game` | the puzzle board | G, 72 | low kalimba, soft plucks |
| `music_w1` | Green Forest | F, 68 | low breathy flute, soft ukulele |
| `music_w2` | Sunny Beach | D, 78 | low steel pan, off-beat strums |
| `music_w3` | Snowy Peaks | A, 62 | music box over felt piano, hushed pad |
| `music_w4` | Desert Dunes | D Phrygian-dominant, 72 | low oud, kalimba, warm pad |
| `music_w5` | Night Sky | C Lydian, 60 | low glass bells, deep pad, long echoes |

Loops are stored at 11 kHz (they hold nothing higher), which keeps the whole set
around 7 MB.

The bass, pads, arpeggios and percussion are written out; the lead melody is
generated under musical rules so it cannot clash (long notes and beats 1 and 3
are always chord tones, short off-beat notes pass stepwise through the scale,
immediate repeats are avoided, phrases end on chord tones, and the second phrase
answers the first). Changing world on the map **crossfades** to that world's tune.

**Effects (21) — soft and tuned.** Warm marimba / felt-piano / wooden voices with
gentle envelopes, low-passed: nothing bright, nothing buzzy, and no low thumps
(a bass "thud" is inaudible on a phone speaker, so it only reads as a dull "doom").
A block landing is a soft wooden "tok" with a small warm ring; taps are a short
marimba blip:
`tap`, `select` (tapping a level),
`locked`, `unlock`, `place`, `rotate`, `deny`, `blast`, `combo`, `power`, `coin`,
`star` / `star2` / `star3` (the three stars of a rating ring **in rising
pitch**), `win`, `lose`, `reward`, `swipe` (switching tab or world), `pop` (a card
opening), `start` and `tick`.

**Sound controls.** Settings has separate **Music** and **Sound Effects**
on/off switches. Music ducks under the result card and while paused, and
everything goes quiet when the app is backgrounded.
The engine is `src/audio/engine.ts`.

### How the loops are made seamless

Music is rendered with wrap-around mixing — any note whose tail runs past the end
of the loop is folded back onto the start — and the reverb and echoes run
circularly, so the last chord flows into the first with no gap, click or dropped
release.

### What the audio checks can and cannot tell you

`check-audio` verifies structure: valid 16-bit mono WAV headers, no clipping, no
silent files, every effect starting and ending near zero (so it cannot click),
tails that have decayed, no bar line where the level collapses, a loop seam as
smooth as an ordinary bar line, and **spectral warmth** — every loop has a
spectral centroid under 700 Hz and no energy above 5 kHz (every effect: under 1.1 kHz), which is the
measurable part of "relaxing".

It **cannot tell you whether the audio sounds good.** That is a matter of taste,
and this has only been checked by measurement and by reading the generated notes
back as note names — not by ear. Give it a listen on a device; levels, pitches,
rhythms and instruments are plain constants in `scripts/audio/music.js` and
`sfx.js` if anything wants adjusting.

Playback uses `expo-audio`, which ships in Expo Go. Every call is wrapped in
try/catch, so a device that cannot play a sound loses the sound, never the game.

---

## Languages

English, Spanish and Portuguese, switchable in Settings and persisted. Strings
live in one `STRINGS` table; add a column to add a language.

---

## Stack

| Package | Use |
| --- | --- |
| `react-native-reanimated` 4.5 | All animation, on the UI thread (36 animated-style / derived-value worklets) |
| `expo-font` + `@expo-google-fonts/lilita-one` | The chunky Lilita One display font, used for all text (SIL OFL) |
| `react-native-gesture-handler` 2.32 | Drag and tap |
| `react-native-svg` 15.15 | Bricks, board, icons, logo |
| `expo-linear-gradient` | Sky, buttons, overlays |
| `expo-haptics` | Place, blast, combo, win, lose, reward |
| `expo-audio` | 11 sound effects and 2 looping music tracks |
| `@react-native-async-storage/async-storage` | The whole save |

Button art is CC0 PNG (see *Art direction*); the scenery, welcome scene, icons, bricks and
chest are vector SVG built from plain gradients and shapes. Nothing uses SVG
filters (blur): they render differently between web and Android.

Correction to an earlier version of this file: it said Skia was not available in
Expo Go. It is (SDK 57 bundles `@shopify/react-native-skia` 2.6, `expo-blur`
and `lottie-react-native`). Skia was still not used, because the SVG route
could be checked in a browser render in this environment and Skia's web build
needs a CanvasKit download. If you want richer effects on device — real
inner shadows, particle systems — Skia is the natural next step.

---

## Performance

- Drag, snap, spring-back, rotation, confetti and every banner run as worklets.
  The JS thread is touched on grab, on a cell-boundary crossing, and on drop.
- The dragged block floats a cell above your finger so your hand never covers it.
- `TrayBlock` is `React.memo` over primitives and stable shared values, so hover
  updates during a drag re-render one block, not three.
- Board geometry is memoised on board content and cell size.

---

## Editing a level

`LEVEL_DATA` entries are small:

```ts
{ s: 1, obj: 'crystals:0', moves: 24, stars: [1425, 2930, 3190], bag: 'easy', crystal: '15 55 22 41' }
```

`s` is the world. `obj` is `type:target` — `lines` and `score` use the target,
while `crystals`, `ice` and `clear` are satisfied by removing every one on the
board. Cell lists are `"rc rc"` pairs. `bag` picks the shape mix
(`easy` / `mid` / `hard`).

If you change a level, re-run the tuner so its move limit and star tiers are
re-derived, then re-run the headless suite.

---

## A note on file size

`App.tsx` is now ~5,500 lines, kept as a single file per the original
constraint. If this grows further it is worth splitting — the natural seams are
the rules engine, the UI primitives, the screens, and the level data, all of
which are already self-contained blocks with no cross-talk.
