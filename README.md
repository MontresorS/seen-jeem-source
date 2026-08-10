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

## AI image-question workflow (separate, offline)

This workflow uses the OpenAI Images API via OPENAI_API_KEY from the environment only. It never writes to client/src/data/questions.ts or client/public/images/ until an explicit promotion step is run.

### Setup

```bash
export OPENAI_API_KEY=...
```

### Dry run

```bash
npm run generate:ai-image-questions -- --dry-run
npm run verify:ai-image-questions -- --dry-run
```

### Generate new AI image-question assets

```bash
npm run generate:ai-image-questions
```

This uses the seed list in scripts/ai-image-question-seeds.json, writes generated source images and review outputs under ignored local folders, creates pending-review mappings only, and never auto-approves or copies final assets to client/public/images/.

### Verify generated images

```bash
npm run verify:ai-image-questions
```

This uses a vision-capable OpenAI call to inspect each generated source image and produce structured verification metadata under artifacts/image-review/.

### Open the review report

```bash
npm run review:image-questions
```

Then open:

- http://127.0.0.1:4174/ai-image-review.html

### Promote approved assets

```bash
npm run promote:ai-image-questions
```

This promotes only approved mappings, adds the exact ten question records to client/src/data/questions.ts, copies approved assets into client/public/images/, runs validation, and prints a Git diff. It never auto-commits or auto-pushes.

### Build and validate

```bash
npm run build
npm run validate:image-questions
```
