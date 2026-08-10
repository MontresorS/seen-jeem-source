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
npm run update:image-mapping -- <status> <questionId> <mode> <sourceImage> <questionPrompt> <arabicAnswer> <points>
```

Examples:

```bash
npm run update:image-mapping -- pending-review zoom-1 ./source-images/example.jpg
npm run update:image-mapping -- pending-review wadda7-1 ./source-images/example.jpg
```

## Validate approved mappings

Run:

```bash
npm run validate:image-questions
```

This fails if an approved mapping references a nonexistent question ID or a missing source image.
