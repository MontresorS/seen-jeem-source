import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { CATEGORIES, type Difficulty } from "../client/src/data/questions.ts";
import { APPROVED_ZOOM_WADDA7_ASSETS } from "../client/src/data/zoom-wadda7-approved-assets.ts";

type WorkflowCategory = "zoom" | "wadda7";

type CropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SourceEntry = {
  source: string;
  category: WorkflowCategory;
  questionId?: string;
  description?: string;
  outputName?: string;
  reviewNotes?: string;
  zoom?: {
    manualCrop?: CropBox;
  };
};

type SourceConfig = {
  entries: SourceEntry[];
};

type ManifestOutput = {
  label: string;
  relativePath: string;
  role: "zoom-crop" | "wadda7-stage";
  pointsLabel?: Difficulty;
};

type ManifestEntry = {
  entryId: string;
  category: WorkflowCategory;
  mode: WorkflowCategory;
  sourceImage: string;
  sourceFilename: string;
  outputName: string;
  questionId: string | null;
  questionPrompt: string | null;
  answerOrDescription: string | null;
  pointTier: Difficulty | null;
  reviewNotes: string;
  outputs: ManifestOutput[];
  defaultZoomOutputLabel?: string;
};

type GeneratedManifest = {
  schemaVersion: 1;
  generatedAt: string;
  entries: ManifestEntry[];
};

type ApprovalEntry = {
  entryId: string;
  category: WorkflowCategory;
  questionId: string | null;
  status: "pass" | "needs-fix";
  selectedOutputLabel?: string;
};

type ApprovalFile = {
  schemaVersion: 1;
  savedAt: string;
  entries: ApprovalEntry[];
};

type QuestionLookup = {
  id: string;
  q: string;
  a: string;
  points: Difficulty;
  category: WorkflowCategory;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const workflowRoot = path.join(repoRoot, "local-workflows", "zoom-wadda7");
const inputRoot = path.join(workflowRoot, "input");
const outputRoot = path.join(workflowRoot, "output");
const configPath = path.join(inputRoot, "source-images.json");
const manifestPath = path.join(outputRoot, "zoom-wadda7.generated.json");
const reviewHtmlPath = path.join(outputRoot, "zoom-wadda7-review.html");
const approvalDraftPath = path.join(outputRoot, "zoom-wadda7.approved.json");
const appliedMappingPath = path.join(repoRoot, "client", "src", "data", "zoom-wadda7-approved-assets.ts");
const publicImagesRoot = path.join(repoRoot, "client", "public", "images");
const generatedZoomDir = path.join(publicImagesRoot, "generated", "zoom");
const generatedWadda7Dir = path.join(publicImagesRoot, "generated", "wadda7");
const force = process.argv.includes("--force");

const questionLookup = new Map<string, QuestionLookup>();

for (const category of CATEGORIES) {
  if (category.key !== "zoom" && category.key !== "wadda7") continue;
  for (const question of category.questions) {
    questionLookup.set(question.id, {
      id: question.id,
      q: question.q,
      a: question.a,
      points: question.points,
      category: category.key,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "generate":
      await generateAssets();
      return;
    case "review":
      await renderReviewHtml();
      return;
    case "validate":
      await validateAppliedAndDraftMappings();
      return;
    case "apply":
      await applyApprovedMappings();
      return;
    default:
      throw new Error("Usage: tsx scripts/zoom-wadda7-local-workflow.ts <generate|review|validate|apply> [--force]");
  }
}

async function generateAssets(): Promise<void> {
  ensureDir(generatedZoomDir);
  ensureDir(generatedWadda7Dir);
  ensureDir(outputRoot);

  const config = loadSourceConfig();
  const entries: ManifestEntry[] = [];

  for (const entry of config.entries) {
    const resolvedSourcePath = resolveWorkflowPath(entry.source);
    if (!fs.existsSync(resolvedSourcePath)) {
      throw new Error(`Source image not found: ${entry.source}`);
    }

    const question = resolveQuestion(entry);
    const outputName = slugify(entry.outputName || question?.id || path.parse(resolvedSourcePath).name);
    const entryId = `${entry.category}:${outputName}`;

    let outputs: ManifestOutput[];
    let defaultZoomOutputLabel: string | undefined;

    if (entry.category === "zoom") {
      outputs = await generateZoomOutputs(entry, resolvedSourcePath, outputName);
      defaultZoomOutputLabel = outputs[0]?.label;
    } else {
      outputs = await generateWadda7Outputs(resolvedSourcePath, outputName);
    }

    entries.push({
      entryId,
      category: entry.category,
      mode: entry.category,
      sourceImage: toRepoRelative(resolvedSourcePath),
      sourceFilename: path.basename(resolvedSourcePath),
      outputName,
      questionId: question?.id ?? null,
      questionPrompt: question?.q ?? null,
      answerOrDescription: question?.a ?? entry.description ?? null,
      pointTier: question?.points ?? null,
      reviewNotes: entry.reviewNotes ?? "",
      outputs,
      defaultZoomOutputLabel,
    });
  }

  const manifest: GeneratedManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };

  writeJson(manifestPath, manifest);
  console.log(`Generated ${entries.length} manifest entries: ${toRepoRelative(manifestPath)}`);
}

async function renderReviewHtml(): Promise<void> {
  const manifest = loadManifest();
  const approvals = loadApprovalDraft(false);
  ensureDir(outputRoot);

  const approvalByEntryId = new Map(approvals.entries.map((entry) => [entry.entryId, entry]));
  const embeddedManifest = JSON.stringify(manifest);
  const embeddedApprovals = JSON.stringify(approvals);

  const cards = manifest.entries
    .map((entry) => {
      const approval = approvalByEntryId.get(entry.entryId);
      const status = approval?.status ?? "needs-fix";
      const selectedOutputLabel = approval?.selectedOutputLabel ?? entry.defaultZoomOutputLabel ?? entry.outputs[0]?.label ?? "";
      const outputsHtml = entry.outputs
        .map((output) => {
          const checked = output.label === selectedOutputLabel ? "checked" : "";
          const selector =
            entry.category === "zoom"
              ? `<label class="output-choice"><input type="radio" name="crop-${escapeHtml(entry.entryId)}" value="${escapeHtml(output.label)}" ${checked}>${escapeHtml(output.label)}</label>`
              : `<span class="stage-pill">${escapeHtml(output.label)}</span>`;

          return `
            <div class="output">
              <img src="${escapeHtml(relativeFilePath(reviewHtmlPath, path.join(repoRoot, output.relativePath)))}" alt="${escapeHtml(output.label)}">
              <div class="output-meta">
                <span>${escapeHtml(output.relativePath)}</span>
                ${selector}
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <article class="card" data-entry-id="${escapeHtml(entry.entryId)}" data-category="${escapeHtml(entry.category)}" data-question-id="${escapeHtml(entry.questionId ?? "")}">
          <header class="card-header">
            <div>
              <h2>${escapeHtml(entry.entryId)}</h2>
              <p>${escapeHtml(entry.category)} · ${escapeHtml(entry.sourceFilename)}</p>
            </div>
            <div class="status-group">
              <button type="button" class="status-button ${status === "pass" ? "active pass" : ""}" data-status="pass">Pass</button>
              <button type="button" class="status-button ${status === "needs-fix" ? "active needs-fix" : ""}" data-status="needs-fix">Needs-fix</button>
            </div>
          </header>
          <dl class="meta-grid">
            <div><dt>Question ID</dt><dd>${escapeHtml(entry.questionId ?? "—")}</dd></div>
            <div><dt>Points</dt><dd>${escapeHtml(String(entry.pointTier ?? "—"))}</dd></div>
            <div><dt>Prompt</dt><dd>${escapeHtml(entry.questionPrompt ?? "—")}</dd></div>
            <div><dt>Answer / description</dt><dd>${escapeHtml(entry.answerOrDescription ?? "—")}</dd></div>
            <div><dt>Source</dt><dd>${escapeHtml(entry.sourceImage)}</dd></div>
            <div><dt>Notes</dt><dd>${escapeHtml(entry.reviewNotes || "—")}</dd></div>
          </dl>
          <section class="outputs">${outputsHtml}</section>
        </article>
      `;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Zoom / Wadda7 review</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, Arial, sans-serif; }
      body { margin: 0; background: #0f172a; color: #e2e8f0; }
      .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(148, 163, 184, 0.25); }
      .toolbar button { border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
      .toolbar .download { background: #22c55e; color: #052e16; }
      .toolbar .summary { color: #cbd5e1; font-size: 14px; }
      main { padding: 20px; display: grid; gap: 16px; }
      .card { background: #111827; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 20px; padding: 16px; display: grid; gap: 16px; }
      .card-header { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; }
      .card-header h2 { margin: 0 0 4px; font-size: 18px; }
      .card-header p { margin: 0; color: #94a3b8; }
      .status-group { display: flex; gap: 8px; flex-wrap: wrap; }
      .status-button { border: 1px solid rgba(148, 163, 184, 0.35); background: transparent; color: inherit; border-radius: 999px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
      .status-button.active.pass { background: #22c55e; color: #052e16; border-color: #22c55e; }
      .status-button.active.needs-fix { background: #f97316; color: #431407; border-color: #f97316; }
      .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0; }
      .meta-grid dt { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
      .meta-grid dd { margin: 0; white-space: pre-wrap; }
      .outputs { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .output { background: rgba(30, 41, 59, 0.65); border-radius: 16px; padding: 12px; display: grid; gap: 10px; }
      .output img { width: 100%; height: 220px; object-fit: contain; background: #020617; border-radius: 12px; }
      .output-meta { display: grid; gap: 8px; font-size: 13px; }
      .output-choice, .stage-pill { display: inline-flex; align-items: center; gap: 6px; }
      .stage-pill { font-weight: 700; color: #bfdbfe; }
      @media (max-width: 640px) {
        .toolbar, .card-header { flex-direction: column; align-items: stretch; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <div>
        <strong>Zoom / Wadda7 local review</strong>
        <div class="summary" id="summary"></div>
      </div>
      <button type="button" class="download" id="download-approvals">Download approval draft</button>
    </div>
    <main>${cards}</main>
    <script>
      const manifest = ${embeddedManifest};
      const initialApprovals = ${embeddedApprovals};
      const storageKey = "zoom-wadda7-review-state";
      const state = new Map();

      for (const entry of initialApprovals.entries || []) {
        state.set(entry.entryId, entry);
      }

      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          for (const entry of parsed.entries || []) {
            state.set(entry.entryId, entry);
          }
        } catch {}
      }

      const ensureState = (entryId, category, questionId, fallbackOutputLabel) => {
        if (!state.has(entryId)) {
          state.set(entryId, {
            entryId,
            category,
            questionId: questionId || null,
            status: "needs-fix",
            selectedOutputLabel: fallbackOutputLabel || undefined
          });
        }
        return state.get(entryId);
      };

      const syncSummary = () => {
        const values = Array.from(state.values());
        const passed = values.filter((entry) => entry.status === "pass").length;
        document.getElementById("summary").textContent = passed + " passed / " + manifest.entries.length + " total";
        window.localStorage.setItem(storageKey, JSON.stringify({
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          entries: values
        }));
      };

      document.querySelectorAll(".card").forEach((card) => {
        const entryId = card.dataset.entryId;
        const category = card.dataset.category;
        const questionId = card.dataset.questionId;
        const fallbackOutputLabel = card.querySelector('input[type="radio"]')?.value;
        const entryState = ensureState(entryId, category, questionId, fallbackOutputLabel);

        card.querySelectorAll(".status-button").forEach((button) => {
          if (button.dataset.status === entryState.status) {
            button.classList.add("active", entryState.status);
          }
          button.addEventListener("click", () => {
            entryState.status = button.dataset.status;
            card.querySelectorAll(".status-button").forEach((candidate) => {
              candidate.classList.remove("active", "pass", "needs-fix");
            });
            button.classList.add("active", entryState.status);
            syncSummary();
          });
        });

        card.querySelectorAll('input[type="radio"]').forEach((input) => {
          if (input.value === entryState.selectedOutputLabel) {
            input.checked = true;
          }
          input.addEventListener("change", () => {
            entryState.selectedOutputLabel = input.value;
            syncSummary();
          });
        });
      });

      syncSummary();

      document.getElementById("download-approvals").addEventListener("click", () => {
        const payload = {
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          entries: manifest.entries.map((entry) => {
            const current = ensureState(entry.entryId, entry.category, entry.questionId, entry.defaultZoomOutputLabel || entry.outputs[0]?.label);
            return {
              entryId: entry.entryId,
              category: entry.category,
              questionId: entry.questionId,
              status: current.status,
              selectedOutputLabel: current.selectedOutputLabel
            };
          })
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "zoom-wadda7.approved.json";
        link.click();
        URL.revokeObjectURL(url);
      });
    </script>
  </body>
</html>`;

  fs.writeFileSync(reviewHtmlPath, html, "utf8");
  console.log(`Review gallery written to ${toRepoRelative(reviewHtmlPath)}`);
}

async function validateAppliedAndDraftMappings(): Promise<void> {
  const errors: string[] = [];

  for (const [questionId, asset] of Object.entries(APPROVED_ZOOM_WADDA7_ASSETS)) {
    const question = questionLookup.get(questionId);
    if (!question) {
      errors.push(`Applied mapping references missing question ID: ${questionId}`);
      continue;
    }
    if (question.category !== asset.category) {
      errors.push(`Applied mapping category mismatch for ${questionId}: expected ${question.category}, got ${asset.category}`);
    }
    if (asset.category === "zoom") {
      validateImagePath(asset.image, `Applied zoom asset ${questionId}`, errors);
    } else {
      if (asset.stages.length !== 3) {
        errors.push(`Applied wadda7 mapping ${questionId} must contain exactly 3 stages`);
      }
      asset.stages.forEach((stagePath, index) => validateImagePath(stagePath, `Applied wadda7 asset ${questionId} stage ${index}`, errors));
    }
  }

  if (fs.existsSync(approvalDraftPath)) {
    const manifest = loadManifest();
    const approvals = loadApprovalDraft(true);
    validateApprovalDraft(manifest, approvals, errors);
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n- ${errors.join("\n- ")}`);
  }

  console.log("Zoom/Wadda7 validation passed");
}

async function applyApprovedMappings(): Promise<void> {
  const manifest = loadManifest();
  const approvals = loadApprovalDraft(true);
  const errors: string[] = [];
  validateApprovalDraft(manifest, approvals, errors);

  if (errors.length > 0) {
    throw new Error(`Cannot apply approvals:\n- ${errors.join("\n- ")}`);
  }

  const manifestByEntryId = new Map(manifest.entries.map((entry) => [entry.entryId, entry]));
  const approvedQuestionIds = new Set<string>();
  const mappings = approvals.entries
    .filter((entry) => entry.status === "pass")
    .map((approval) => {
      const manifestEntry = manifestByEntryId.get(approval.entryId)!;
      const questionId = manifestEntry.questionId!;
      if (approvedQuestionIds.has(questionId)) {
        throw new Error(`More than one approved mapping targets ${questionId}`);
      }
      approvedQuestionIds.add(questionId);

      if (manifestEntry.category === "zoom") {
        const selectedLabel = approval.selectedOutputLabel || manifestEntry.defaultZoomOutputLabel || manifestEntry.outputs[0]?.label;
        const selectedOutput = manifestEntry.outputs.find((output) => output.label === selectedLabel);
        if (!selectedOutput) {
          throw new Error(`Approved zoom mapping ${manifestEntry.entryId} references missing output label ${selectedLabel}`);
        }
        return [questionId, {
          category: "zoom",
          sourceImage: manifestEntry.sourceImage,
          questionId,
          questionPrompt: manifestEntry.questionPrompt!,
          answerOrDescription: manifestEntry.answerOrDescription!,
          pointTier: manifestEntry.pointTier!,
          image: toPublicRelative(selectedOutput.relativePath),
        }] as const;
      }

      const orderedStages = ["stage-600", "stage-400", "stage-200"].map((label) => {
        const output = manifestEntry.outputs.find((candidate) => candidate.label === label);
        if (!output) {
          throw new Error(`Approved wadda7 mapping ${manifestEntry.entryId} is missing ${label}`);
        }
        return toPublicRelative(output.relativePath);
      }) as [string, string, string];

      return [questionId, {
        category: "wadda7",
        sourceImage: manifestEntry.sourceImage,
        questionId,
        questionPrompt: manifestEntry.questionPrompt!,
        answerOrDescription: manifestEntry.answerOrDescription!,
        pointTier: manifestEntry.pointTier!,
        stages: orderedStages,
      }] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right, "en"));

  const content = `export type ApprovedZoomAsset = {
  category: "zoom";
  sourceImage: string;
  questionId: string;
  questionPrompt: string;
  answerOrDescription: string;
  pointTier: 200 | 400 | 600;
  image: string;
};

export type ApprovedWadda7Asset = {
  category: "wadda7";
  sourceImage: string;
  questionId: string;
  questionPrompt: string;
  answerOrDescription: string;
  pointTier: 200 | 400 | 600;
  stages: readonly [string, string, string];
};

export type ApprovedZoomWadda7Asset = ApprovedZoomAsset | ApprovedWadda7Asset;

export const APPROVED_ZOOM_WADDA7_ASSETS: Record<string, ApprovedZoomWadda7Asset> = ${JSON.stringify(Object.fromEntries(mappings), null, 2)} as Record<string, ApprovedZoomWadda7Asset>;

export function getApprovedZoomWadda7Asset(questionId: string): ApprovedZoomWadda7Asset | undefined {
  return APPROVED_ZOOM_WADDA7_ASSETS[questionId];
}
`;

  fs.writeFileSync(appliedMappingPath, content, "utf8");
  console.log(`Applied ${mappings.length} approved mappings to ${toRepoRelative(appliedMappingPath)}`);
}

function validateApprovalDraft(manifest: GeneratedManifest, approvals: ApprovalFile, errors: string[]): void {
  const manifestByEntryId = new Map(manifest.entries.map((entry) => [entry.entryId, entry]));
  const approvedQuestionIds = new Set<string>();

  for (const approval of approvals.entries.filter((entry) => entry.status === "pass")) {
    const manifestEntry = manifestByEntryId.get(approval.entryId);
    if (!manifestEntry) {
      errors.push(`Approval references missing manifest entry: ${approval.entryId}`);
      continue;
    }
    if (!manifestEntry.questionId) {
      errors.push(`Approved entry ${approval.entryId} does not have a question ID`);
      continue;
    }
    const question = questionLookup.get(manifestEntry.questionId);
    if (!question) {
      errors.push(`Approved entry ${approval.entryId} references nonexistent question ID ${manifestEntry.questionId}`);
      continue;
    }
    if (question.category !== manifestEntry.category) {
      errors.push(`Approved entry ${approval.entryId} category mismatch: expected ${question.category}, got ${manifestEntry.category}`);
    }
    if (approvedQuestionIds.has(manifestEntry.questionId)) {
      errors.push(`More than one approved entry targets ${manifestEntry.questionId}`);
    }
    approvedQuestionIds.add(manifestEntry.questionId);

    if (manifestEntry.category === "zoom") {
      const selectedLabel = approval.selectedOutputLabel || manifestEntry.defaultZoomOutputLabel || manifestEntry.outputs[0]?.label;
      const selectedOutput = manifestEntry.outputs.find((output) => output.label === selectedLabel);
      if (!selectedOutput) {
        errors.push(`Approved zoom entry ${approval.entryId} uses a missing crop label: ${selectedLabel}`);
      } else {
        validateImagePath(toPublicRelative(selectedOutput.relativePath), `Approved zoom entry ${approval.entryId}`, errors);
      }
    } else {
      for (const label of ["stage-600", "stage-400", "stage-200"]) {
        const stage = manifestEntry.outputs.find((output) => output.label === label);
        if (!stage) {
          errors.push(`Approved wadda7 entry ${approval.entryId} is missing ${label}`);
          continue;
        }
        validateImagePath(toPublicRelative(stage.relativePath), `Approved wadda7 entry ${approval.entryId} ${label}`, errors);
      }
    }
  }
}

function validateImagePath(publicRelativePath: string, label: string, errors: string[]): void {
  if (!publicRelativePath.startsWith("./images/")) {
    errors.push(`${label} must stay under ./images/, got ${publicRelativePath}`);
    return;
  }
  const absolutePath = path.join(publicImagesRoot, publicRelativePath.replace("./images/", ""));
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${label} points at a missing image: ${publicRelativePath}`);
  }
}

async function generateZoomOutputs(entry: SourceEntry, sourcePath: string, outputName: string): Promise<ManifestOutput[]> {
  const image = sharp(sourcePath).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${entry.source}`);
  }

  const crops = buildZoomCrops(metadata.width, metadata.height, entry.zoom?.manualCrop);
  const labels = ["close-1", "close-2", "close-3"] as const;
  const outputs: ManifestOutput[] = [];

  for (const [index, crop] of crops.entries()) {
    const filename = `${outputName}--${labels[index]}.jpg`;
    const absolutePath = path.join(generatedZoomDir, filename);
    if (force || !fs.existsSync(absolutePath)) {
      await sharp(sourcePath)
        .rotate()
        .extract(crop)
        .resize(1100, 1100, { fit: "cover" })
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(absolutePath);
    }
    outputs.push({
      label: labels[index],
      relativePath: toRepoRelative(absolutePath),
      role: "zoom-crop",
    });
  }

  return outputs;
}

async function generateWadda7Outputs(sourcePath: string, outputName: string): Promise<ManifestOutput[]> {
  const baseBuffer = await sharp(sourcePath)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const metadata = await sharp(baseBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not derive resized dimensions for ${sourcePath}`);
  }

  const variants: Array<{ label: "stage-600" | "stage-400" | "stage-200"; pixelateTo?: number; blur?: number }> = [
    { label: "stage-600", pixelateTo: 40, blur: 2.8 },
    { label: "stage-400", pixelateTo: 110, blur: 1.1 },
    { label: "stage-200" },
  ];

  const outputs: ManifestOutput[] = [];

  for (const variant of variants) {
    const filename = `${outputName}--${variant.label}.jpg`;
    const absolutePath = path.join(generatedWadda7Dir, filename);
    if (force || !fs.existsSync(absolutePath)) {
      let pipeline = sharp(baseBuffer);
      if (variant.pixelateTo) {
        pipeline = pipeline
          .resize(variant.pixelateTo, variant.pixelateTo, { fit: "inside" })
          .resize(metadata.width, metadata.height, { fit: "fill", kernel: sharp.kernel.nearest });
      }
      if (variant.blur) {
        pipeline = pipeline.blur(variant.blur);
      }
      await pipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(absolutePath);
    }
    outputs.push({
      label: variant.label,
      relativePath: toRepoRelative(absolutePath),
      role: "wadda7-stage",
      pointsLabel: variant.label === "stage-600" ? 600 : variant.label === "stage-400" ? 400 : 200,
    });
  }

  return outputs;
}

function buildZoomCrops(width: number, height: number, manualCrop?: CropBox): CropBox[] {
  const minSide = Math.min(width, height);
  const presets: Array<{ scale: number; xRatio: number; yRatio: number }> = [
    { scale: 0.58, xRatio: 0.5, yRatio: 0.5 },
    { scale: 0.72, xRatio: width >= height ? 0.38 : 0.5, yRatio: height > width ? 0.34 : 0.42 },
    { scale: 0.86, xRatio: width >= height ? 0.62 : 0.5, yRatio: height > width ? 0.66 : 0.58 },
  ];

  return presets.map((preset, index) => {
    if (index === 0 && manualCrop) {
      return sanitizeCrop(manualCrop, width, height);
    }
    const cropSize = Math.max(120, Math.round(minSide * preset.scale));
    const left = Math.round(width * preset.xRatio - cropSize / 2);
    const top = Math.round(height * preset.yRatio - cropSize / 2);
    return sanitizeCrop({ left, top, width: cropSize, height: cropSize }, width, height);
  });
}

function sanitizeCrop(crop: CropBox, imageWidth: number, imageHeight: number): CropBox {
  const size = Math.max(1, Math.min(crop.width, crop.height, imageWidth, imageHeight));
  const left = clamp(crop.left, 0, imageWidth - size);
  const top = clamp(crop.top, 0, imageHeight - size);
  return { left, top, width: size, height: size };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveQuestion(entry: SourceEntry): QuestionLookup | null {
  if (!entry.questionId) return null;
  const question = questionLookup.get(entry.questionId);
  if (!question) {
    throw new Error(`Unknown question ID: ${entry.questionId}`);
  }
  if (question.category !== entry.category) {
    throw new Error(`Question ${entry.questionId} belongs to ${question.category}, not ${entry.category}`);
  }
  return question;
}

function loadSourceConfig(): SourceConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Create ${toRepoRelative(configPath)} from the template before running generate.`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as SourceConfig;
  if (!Array.isArray(config.entries) || config.entries.length === 0) {
    throw new Error("source-images.json must contain a non-empty entries array");
  }
  return config;
}

function loadManifest(): GeneratedManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Run generate first: ${toRepoRelative(manifestPath)} does not exist.`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as GeneratedManifest;
}

function loadApprovalDraft(required: boolean): ApprovalFile {
  if (!fs.existsSync(approvalDraftPath)) {
    if (required) {
      throw new Error(`Save the downloaded approval file to ${toRepoRelative(approvalDraftPath)} before applying.`);
    }
    return { schemaVersion: 1, savedAt: new Date(0).toISOString(), entries: [] };
  }
  return JSON.parse(fs.readFileSync(approvalDraftPath, "utf8")) as ApprovalFile;
}

function ensureDir(target: string): void {
  fs.mkdirSync(target, { recursive: true });
}

function writeJson(target: string, value: unknown): void {
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveWorkflowPath(relativePath: string): string {
  const resolved = path.resolve(workflowRoot, relativePath);
  if (!resolved.startsWith(workflowRoot)) {
    throw new Error(`Path escapes workflow root: ${relativePath}`);
  }
  return resolved;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toRepoRelative(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function toPublicRelative(repoRelativePath: string): string {
  return `./images/${repoRelativePath.replace(/^client\/public\/images\//, "")}`;
}

function relativeFilePath(fromFile: string, toFile: string): string {
  return path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
