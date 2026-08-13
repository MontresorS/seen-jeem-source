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

## Latest gameplay corrective scope

### Header + setup checks
- Header wolf logo image must come from `/seen-jeem-logo-new.png`.
- Wolf image is centered in the header with transparent background (no white frame/card).
- Text wordmark **سين وجيم** and subtitle **Montaser's Cool Edition** stay in the top-right with the original text hierarchy.
- In setup card, the **فريقان / ٣ فرق** selector is centered on the same row as **جهّزوا اللعبة 🎉**.
- Heading color for **جهّزوا اللعبة 🎉** is `#3E2723`.

### Board viewport regression matrix
Run `npm run dev`, then verify no clipping/overlap for cards (all 200/400/600 visible per category):

- **Desktop (≥1280px)**
  - 2 teams + 6 categories (baseline readability vs main)
  - 2 teams + 9 categories
  - 2 teams + 12 categories
  - 3 teams + 9 categories
- **Tablet (~768px)**
  - 2 teams + 6 categories
  - 2 teams + 9 categories
  - 3 teams + 9 categories
- **Mobile (~390px)**
  - 2 teams + 6 categories
  - 2 teams + 9 categories
  - 3 teams + 9 categories

### ركّبها صح manual checks
- Open a **ركّبها صح** card and confirm it is a real 3×3 swap puzzle (tap two tiles to swap).
- Locked tiles appear and cannot be swapped.
- Tier behavior:
  - 200: starts with 3 locked correct tiles, hint button usable 2 times.
  - 400: starts with 1 locked correct tile, hint button usable 1 time.
  - 600: starts with no locked tiles, no hint button.
- Confirm scramble starts unsolved and completion is detected only when all tiles are in correct positions.
- After completion, verify celebratory state appears, then host reveals answer and awards/skips manually (no auto-award).
- Category icon for **ركّبها صح** uses local jigsaw emblem from `/images/tilepuzzle/tilepuzzle-emblem.svg`.
