# seen-jeem-source

## Offline Zoom / Wadda7 image workflow

This repository now includes a local-only workflow for `zoom` and `wadda7` images.

### 1) Put original images in the local input folder

- Source images go in `/home/runner/work/seen-jeem-source/seen-jeem-source/local-workflows/zoom-wadda7/input/images/`
- Copy `/home/runner/work/seen-jeem-source/seen-jeem-source/local-workflows/zoom-wadda7/input/source-images.template.json`
  to `/home/runner/work/seen-jeem-source/seen-jeem-source/local-workflows/zoom-wadda7/input/source-images.json`
  and fill in the entries you want to generate.

### 2) Generate static assets + manifest

```bash
npm run generate:zoom-wadda7-assets
```

This creates:

- generated game assets under `client/public/images/generated/zoom/` and `client/public/images/generated/wadda7/`
- a machine-readable manifest at `local-workflows/zoom-wadda7/output/zoom-wadda7.generated.json`

By default existing generated files are reused and not overwritten. Pass `-- --force` to regenerate.

### 3) Review mappings locally

```bash
npm run review:zoom-wadda7-assets
```

Open `local-workflows/zoom-wadda7/output/zoom-wadda7-review.html` in a browser.  
Each card shows the generated images beside the linked question metadata and includes:

- **Pass**
- **Needs-fix**
- a zoom crop selector when multiple crop variants exist

Use **Download approval draft** in the page and save the file as:

`local-workflows/zoom-wadda7/output/zoom-wadda7.approved.json`

### 4) Fix bad matches or bad crops

- If the wrong question is linked, fix `questionId` in `local-workflows/zoom-wadda7/input/source-images.json`
- If a zoom crop is not good enough, either select a different generated crop in review or add `zoom.manualCrop`
  in `source-images.json`, then rerun generation and review
- If a record should not be used yet, leave it as **Needs-fix**

### 5) Apply only approved mappings to the game

```bash
npm run apply:zoom-wadda7-assets
```

That command reads the saved approval draft and updates:

- `client/src/data/zoom-wadda7-approved-assets.ts`

Only approved mappings are written to the game-facing file.

### 6) Validate before committing

```bash
npm run validate:zoom-wadda7-assets
npm run build
```

Validation fails if an approved/applied mapping points at a missing generated image or a nonexistent question ID.

### 7) Commit only the approved game assets

When you are ready, commit:

- approved generated files in `client/public/images/generated/`
- `client/src/data/zoom-wadda7-approved-assets.ts`

Do **not** commit:

- original source photos in `local-workflows/zoom-wadda7/input/images/`
- local review/output files in `local-workflows/zoom-wadda7/output/`
