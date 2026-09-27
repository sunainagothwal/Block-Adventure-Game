# Google Play listing — Block Adventure

Package: `com.blockadventure.puzzle` · Category: **Games → Puzzle** · Price: Free

## App name (max 30)
```
Block Adventure: Puzzle Blast
```
(29 characters)

## Short description (max 80)
```
Drag blocks, clear lines and blast through 60 levels across 5 magical worlds.
```
(77 characters)

## Full description (max 4000)

```
Match. Blast. Solve. Explore.

Drag colourful blocks onto the 8x8 board. Fill a whole row or column and it blasts away. That's the entire rule - everything else is the adventure built on top of it!

BLOCK BLAST PUZZLES WITH A TWIST
Every level gives you a goal and a limited number of moves. Clear lines, pop crystals, break ice or reach a target score before you run out of moves - or out of room. Plan ahead, chain your clears and go for combos to earn bigger scores and more stars.

TRAVEL THROUGH 5 MAGICAL WORLDS
Follow a winding path across hand-drawn maps and unlock 60 levels:
- Green Forest - learn the ropes in a sunny glade
- Sunny Beach - crystals hide in the sand
- Snowy Peaks - ice blocks that only break when a line clears through them
- Desert Dunes - solid stone that never clears but still fills the board
- Night Sky - crystals, ice and stone together under the aurora

Each world brings a new idea, with easier levels sprinkled in so the challenge never feels like a straight climb. Every level has been tested over and over to make sure it can be beaten.

POWER-UPS WHEN YOU'RE STUCK
- Hint - shows a good move
- Undo - take back your last move
- Shuffle - swap your three blocks
- Hammer - smash a single block
- Rocket - clear a whole row and column
- Bomb - blast a 3x3 area
- Magic Block - turn your biggest piece into a 1x1
- Color Blast - clear every block of one colour

REWARDS EVERY DAY
- Earn up to 3 stars on every level
- Collect coins and spend them on power-ups
- Claim the 7-day Daily Reward ladder, with power-ups and treasure chests
- Earn a key for every new level you clear and open the Treasure Chest

DESIGNED FOR RELAXED, SATISFYING PLAY
- Simple drag-and-drop controls - one finger, one hand
- Rotate any block with a tap
- A live preview shows which line is about to blast
- Calm, original music and soft, tuned sound effects
- Bright, cartoon-style art and a friendly block mascot
- Works completely offline - play anywhere
- No ads and no in-app purchases
- Available in English, Spanish and Portuguese

Whether you have two minutes or an hour, Block Adventure is an easy-to-learn, hard-to-put-down puzzle game. Download it now and start your adventure!
```

## What's new (release notes, max 500)
```
Welcome to Block Adventure! 60 levels, 5 worlds, 8 power-ups, daily rewards and a treasure chest. Have fun!
```

## Store settings to fill in

| Field | Suggested value |
| --- | --- |
| Category | Game → Puzzle |
| Tags | Puzzle, Block, Casual, Offline, Single player |
| Contains ads | **No** |
| In-app purchases | **No** |
| Target audience | 13+ is the safe choice; if you target under 13 you must also meet the Families policy |
| Content rating | Answer the IARC questionnaire honestly: no violence, no user-generated content, no gambling, no chat |
| Data safety | The app makes no network requests and has no analytics or ads SDK. Progress is stored only on the device (AsyncStorage). You can declare **"No data collected"** and **"No data shared"**. Re-check this if you add ads, analytics or cloud save. |
| Privacy policy | Play Console requires a URL even for apps that collect nothing. A one-page "this app collects no data" policy is enough. |
| Contact email | Required. Use an address you are happy to show publicly. |

## Graphic assets in this folder

| File | Play Console slot | Spec |
| --- | --- | --- |
| `icon-512.png` | App icon | 512 x 512 PNG, under 1 MB (114 KB) |
| `feature-graphic-1024x500.png` | Feature graphic | 1024 x 500 (420 KB) |
| `screenshots/01.png` - `08.png` | Phone screenshots | 1080 x 1920 (9:16), 8 max, each under 8 MB |

Screenshot order and captions:

1. Match. Blast. Solve. Explore. (welcome / home)
2. Drag blocks, fill the lines (crystal level, Beach world)
3. Blast combos for huge scores! (ice level, mid-blast)
4. Pop crystals, break the ice (Night Sky level, mid-blast)
5. Explore 5 magical worlds (Snowy World map)
6. Earn stars and coins (Level Completed)
7. Daily rewards & treasure chests
8. 60 handcrafted levels to conquer (Night Sky map)

## Things to know before uploading

- **Tablet screenshots** (7-inch and 10-inch) are optional, but Play may ask for them if the app is available on tablets. The app is portrait-only; if you want tablet listings, say so and I can generate them.
- The screenshots are **real renders of the game** (web build in headless Chrome at 360x640 @3x, with a bot playing the boards). They are not photos from a device, so fonts may differ a little from Android. Swapping in genuine device screenshots later is fine; the layout template is easy to reuse.
- Screens 2-4 show the real in-game HUD from levels 13, 25 and 49; screen 8 and 5 show maps from a save that has progress. The coin counter reads 1,280 because of that seeded save.
- The icon is an original design (yellow block mascot from the game with two accent blocks). It is not yet wired into `app.json`; the project has no `icon` or `android.adaptiveIcon` set. For the app itself, Expo needs a 1024x1024 icon plus an adaptive-icon foreground. Ask if you want those generated.
- The in-app "Rate Us" button already points at `com.blockadventure.puzzle`, so it starts working once the listing is live.
