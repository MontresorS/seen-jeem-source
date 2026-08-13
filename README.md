# Image Question Content Pipeline

## Overview

This project now includes a local image-content pipeline for the existing zoom and wadda7 modes.

## Important constraints

- Existing game rules, question IDs, point tiers, ordering, progress, and runtime rendering remain unchanged.
- Only approved game image assets go under client/public/images/.
- Review-only assets and temporary generation output stay outside the production bundle under artifacts/image-review/ and tmp/.

## Local source image folder

Put approved original photos in:

- source-images/

These files are ignored by Git and are not part of the production bundle.

## Generate assets

Run:

```bash
npm run generate:image-questions
```

This reads mappings from artifacts/image-review/mappings.json and generates review images plus any approved game assets under client/public/images/.

## Open the local review gallery

Run:

```bash
npm run review:image-questions
```

Then open:

- http://127.0.0.1:4174/

## Mark a mapping approved or needs fixing

Use:

```bash
npm run update:image-mapping -- <pending-review|approved|needs-fixing> <questionId> <sourceImagePath>
```

Example:

```bash
npm run update:image-mapping -- pending-review zoom-1 ./source-images/pineapple.jpg
```

## Validate approved mappings

Run:

```bash
npm run validate:image-questions
```

This fails if an approved mapping references a nonexistent question ID or a missing source image.

## Latest gameplay scope update (PR #8 replacement)

### Changed files
- `client/src/game/state.tsx`
- `client/src/game/Setup.tsx`
- `client/src/game/Board.tsx`
- `client/src/game/Question.tsx`
- `client/src/game/Results.tsx`
- `client/src/game/ui.tsx`
- `client/src/pages/game.tsx`
- `client/src/data/questions.ts`
- `client/src/data/newModes.ts`
- `scripts/validate-game-enhancements.ts`
- `client/public/seen-jeem-logo.png`
- `package.json`

### What was implemented
- 2-team and 3-team setup rules:
  - 2 teams: exactly 6/9/12 categories.
  - 3 teams: exactly 9 categories with responsive 3×3 board layout.
- Third team name input, 3-team score/turn UI, rotation/scoring updates, and multi-team result handling.
- New mode **ركّبها صح**:
  - Local 3×3 tile puzzle board.
  - 1–2 initial revealed tiles.
  - Reveal-one-tile control.
  - 50 stable local rounds with 17/17/16 (200/400/600).
- New mode **مين الكدّاب**:
  - Exactly three statements (أ/ب/ج).
  - Exactly one false statement per round.
  - Reveal includes concise explanation.
  - 50 stable rounds with 17/17/16 (200/400/600).
- Added once-per-team **اختيارين بس** lifeline:
  - Removes one wrong option when a safe structured choice model exists.
  - Remains visible but disabled for unsupported question formats.
- Logo update:
  - Added local PNG `/seen-jeem-logo.png` derived from local JPG source.
  - Replaced old logo usage in UI and removed white card-style frame.
  - Increased displayed logo size and centered header presentation.
- Wadda7 initial blur increased by +15% (initial blur step now 27.6px).
- Added focused validation script for setup rules, 3-team rotation/scoring, round distributions, liar one-false rule, local tile mappings, and once-per-team lifeline behavior.

### Validation and build results
- `npm run validate:game-enhancements` ✅
- `npm run validate:image-questions` ✅
- `npm run build` ✅

### Limitations / notes
- Existing non-task warnings from build tooling (large chunk size warning) remain unchanged.
- Puzzle content is intentionally local-only and mapped to committed local assets.
- `npm run check` still fails بسبب أخطاء TypeScript قديمة غير مرتبطة بهذا التغيير في:
  - `client/src/game/Charades.tsx` (مراجع حالة/أكشن غير موجودة أصلًا)
  - `client/src/game/QRDisplay.tsx` (تعريف نوع `qrcode` مفقود)

### Manual test flow
1. Run `npm install`.
2. Run `npm run validate:game-enhancements`.
3. Run `npm run build`.
4. Run app (`npm run dev`) and verify:
   - Setup allows 2 teams (6/9/12 categories) and 3 teams (exactly 9).
   - 3-team board shows 3 team panels and turn rotation.
   - Category **ركّبها صح** shows shuffled 3×3 tiles with 1–2 reveals and reveal-one control.
   - Category **مين الكدّاب** shows exactly 3 statements with one false and explanation on reveal.
   - Lifeline **اختيارين بس** can be used once per team, removes one wrong option when enabled, and is disabled/visible when unsupported.
   - Logo is rendered from local PNG at larger size without white rectangle framing.
