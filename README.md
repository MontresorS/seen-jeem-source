# seen-jeem-source

## Offline Zoom / Wadda7 image workflow

This repository includes a free local workflow for `zoom` and `wadda7` images.
Source-image generation uses the public Pollinations image endpoint with no API key,
and Zoom crops / Wadda7 clarity stages are still generated locally with Sharp.
No generated asset is promoted into `client/public/images/` until the explicit promotion step.

### 1) Prepare the local config

- Copy `/home/runner/work/seen-jeem-source/seen-jeem-source/local-workflows/zoom-wadda7/input/source-images.template.json`
  to `/home/runner/work/seen-jeem-source/seen-jeem-source/local-workflows/zoom-wadda7/input/source-images.json`
- Each entry must use exactly one of:
  - `prompt` for a Pollinations-generated source image saved under the ignored local folder
    `local-workflows/zoom-wadda7/input/generated-source-images/`
  - `source` for an already-local source image under
    `/home/runner/work/seen-jeem-source/seen-jeem-source/local-workflows/zoom-wadda7/input/images/`
- `questionId`, mode, prompt text, answer, and points are validated against the seed record in `client/src/data/questions.ts`

### 2) Dry-run without network or file writes

```bash
npm run generate:zoom-wadda7-assets -- --dry-run
```

`--dry-run` is strictly read-only and network-free. It prints the planned mappings,
the source-image request count, and the output file paths without contacting Pollinations
or writing any files.

### 3) Generate source images + local outputs

```bash
npm run generate:zoom-wadda7-assets
```

This command:

- uses Pollinations only when an entry provides `prompt`
- enforces a hard cap of **10 source-image requests per run**
- retries Pollinations failures with a timeout and clear non-image / invalid-image errors
- saves generated source images only under the ignored local folder
  `local-workflows/zoom-wadda7/input/generated-source-images/`
- stages Sharp-based outputs only under the ignored local folder
  `local-workflows/zoom-wadda7/output/generated/zoom/`
  and `local-workflows/zoom-wadda7/output/generated/wadda7/`
- writes a machine-readable manifest at `local-workflows/zoom-wadda7/output/zoom-wadda7.generated.json`

By default existing generated files are reused and not overwritten. Pass `-- --force` to regenerate.

### 4) Review mappings locally

```bash
npm run review:zoom-wadda7-assets
```

Open `local-workflows/zoom-wadda7/output/zoom-wadda7-review.html` in a browser.
Each card shows the generated images beside the linked seed metadata and includes:

- **Approved**
- **Pending-review**
- **Needs-fixing**
- a zoom crop selector when multiple crop variants exist

Pollinations-generated entries start as **Pending-review**.
Local checks can move a failed entry to **Needs-fixing**, but they never auto-approve it.
The gallery remains the final human confirmation that the generated photo really matches the Arabic answer.

Use **Download approval draft** in the page and save the file as:

`local-workflows/zoom-wadda7/output/zoom-wadda7.approved.json`

### 5) Fix bad matches or bad crops

- If the wrong question is linked, fix `questionId` in `local-workflows/zoom-wadda7/input/source-images.json`
- If a Pollinations source image is wrong, update the entry `prompt` and rerun generation
- If a zoom crop is not good enough, either select a different generated crop in review or add `zoom.manualCrop`
  in `source-images.json`, then rerun generation and review
- If a record should not be applied yet, leave it as **Pending-review** or **Needs-fixing**

### 6) Promote only manually approved mappings to the game

```bash
npm run promote:zoom-wadda7-assets
```

That command reads the saved approval draft and updates:

- `client/public/images/generated/zoom/`
- `client/public/images/generated/wadda7/`
- `client/src/data/zoom-wadda7-approved-assets.ts`

Only **Approved** mappings are written to the game-facing file.
Entries left as **Pending-review** or **Needs-fixing** stay out of the game.

### 7) Validate before committing

```bash
npm run validate:zoom-wadda7-assets
npm run build
```

Validation is local-only. It checks that:

- source and generated files exist and are valid images
- mapping IDs exist
- mode / prompt / answer / points match the seed record
- expected generated outputs exist
- image dimensions are valid
- zero-byte files and invalid image metadata are rejected

### 8) Commit only the approved game assets

When you are ready, commit:

- approved generated files in `client/public/images/generated/`
- `client/src/data/zoom-wadda7-approved-assets.ts`

Do **not** commit:

- original source photos in `local-workflows/zoom-wadda7/input/images/`
- Pollinations-generated source images in `local-workflows/zoom-wadda7/input/generated-source-images/`
- local review/output files in `local-workflows/zoom-wadda7/output/`
