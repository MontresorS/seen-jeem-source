import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { CATEGORIES, type Difficulty } from "../client/src/data/questions.ts";
import { APPROVED_ZOOM_WADDA7_ASSETS } from "../client/src/data/zoom-wadda7-approved-assets.ts";

type WorkflowCategory = "zoom" | "wadda7";
type ReviewStatus = "approved" | "pending-review" | "needs-fixing";
type SourceOrigin = "local" | "pollinations";

type CropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SourceEntry = {
  mappingId?: string;
  source?: string;
  prompt?: string;
  category: WorkflowCategory;
  questionId: string;
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
  mappingId: string;
  category: WorkflowCategory;
  mode: WorkflowCategory;
  sourceImage: string;
  sourceFilename: string;
  sourceOrigin: SourceOrigin;
  sourcePrompt: string | null;
  outputName: string;
  questionId: string;
  questionPrompt: string;
  answerOrDescription: string;
  pointTier: Difficulty;
  reviewNotes: string;
  outputs: ManifestOutput[];
  defaultZoomOutputLabel?: string;
  reviewStatus: ReviewStatus;
  validationErrors: string[];
};

type GeneratedManifest = {
  schemaVersion: 2;
  generatedAt: string;
  entries: ManifestEntry[];
};

type ApprovalEntry = {
  entryId: string;
  mappingId: string;
  category: WorkflowCategory;
  questionId: string;
  status: ReviewStatus;
  selectedOutputLabel?: string;
};

type ApprovalFile = {
  schemaVersion: 2;
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

type SourceResolution = {
  sourceAbsolutePath: string;
  sourceOrigin: SourceOrigin;
  sourcePrompt: string | null;
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
const generatedSourceRoot = path.join(inputRoot, "generated-source-images");
const appliedMappingPath = path.join(repoRoot, "client", "src", "data", "zoom-wadda7-approved-assets.ts");
const publicImagesRoot = path.join(repoRoot, "client", "public", "images");
const stagedGeneratedRoot = path.join(outputRoot, "generated");
const stagedGeneratedZoomDir = path.join(stagedGeneratedRoot, "zoom");
const stagedGeneratedWadda7Dir = path.join(stagedGeneratedRoot, "wadda7");
const promotedGeneratedZoomDir = path.join(publicImagesRoot, "generated", "zoom");
const promotedGeneratedWadda7Dir = path.join(publicImagesRoot, "generated", "wadda7");

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");
const pollinationsBaseUrl = getFlagValue("--pollinations-base-url=") ?? "https://image.pollinations.ai/prompt/";
const MAX_SOURCE_IMAGE_REQUESTS_PER_RUN = 10;
const POLLINATIONS_TIMEOUT_MS = 20_000;
const POLLINATIONS_RETRY_ATTEMPTS = 3;

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
    case "promote":
    case "apply":
      await promoteApprovedMappings();
      return;
    default:
      throw new Error(
        "Usage: tsx scripts/zoom-wadda7-local-workflow.ts <generate|review|validate|promote> [--force] [--dry-run] [--pollinations-base-url=<url>]",
      );
  }
}

async function generateAssets(): Promise<void> {
  const config = loadSourceConfig();
  const requestPlanCount = countPlannedSourceImageRequests(config.entries);
  if (requestPlanCount > MAX_SOURCE_IMAGE_REQUESTS_PER_RUN) {
    throw new Error(
      `This run would require ${requestPlanCount} source-image requests, which exceeds the hard cap of ${MAX_SOURCE_IMAGE_REQUESTS_PER_RUN}. Split the run into smaller batches.`,
    );
  }

  if (dryRun) {
    printDryRunPlan(config.entries, requestPlanCount);
    return;
  }

  ensureDir(generatedSourceRoot);
  ensureDir(stagedGeneratedZoomDir);
  ensureDir(stagedGeneratedWadda7Dir);
  ensureDir(outputRoot);

  const requestBudget = { used: 0 };
  const entries: ManifestEntry[] = [];
  const failedEntryIds: string[] = [];

  for (const entry of config.entries) {
    const question = resolveQuestion(entry);
    const outputName = slugify(entry.outputName || question.id);
    const mappingId = slugify(entry.mappingId || `${entry.category}-${question.id}-${outputName}`);
    const entryId = `${entry.category}:${mappingId}`;

    const manifestEntry = await buildManifestEntry(entry, question, outputName, mappingId, entryId, requestBudget);
    if (manifestEntry.reviewStatus === "needs-fixing") {
      failedEntryIds.push(entryId);
    }
    entries.push(manifestEntry);
  }

  const manifest: GeneratedManifest = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    entries,
  };

  writeJson(manifestPath, manifest);
  console.log(`Generated ${entries.length} manifest entries: ${toRepoRelative(manifestPath)}`);

  if (failedEntryIds.length > 0) {
    throw new Error(
      `Generation completed with ${failedEntryIds.length} mapping(s) marked needs-fixing: ${failedEntryIds.join(", ")}. Review ${toRepoRelative(manifestPath)} for details.`,
    );
  }
}

async function buildManifestEntry(
  entry: SourceEntry,
  question: QuestionLookup,
  outputName: string,
  mappingId: string,
  entryId: string,
  requestBudget: { used: number },
): Promise<ManifestEntry> {
  const validationErrors: string[] = [];
  const outputs: ManifestOutput[] = [];
  let defaultZoomOutputLabel: string | undefined;
  let sourceResolution: SourceResolution | null = null;

  try {
    sourceResolution = await resolveSourceImage(entry, outputName, requestBudget);
    await validateAbsoluteImageFile(sourceResolution.sourceAbsolutePath, `Source image for ${entryId}`, validationErrors);

    if (validationErrors.length === 0) {
      if (entry.category === "zoom") {
        const generated = await generateZoomOutputs(entry, sourceResolution.sourceAbsolutePath, outputName);
        outputs.push(...generated);
        defaultZoomOutputLabel = generated[0]?.label;
      } else {
        outputs.push(...(await generateWadda7Outputs(sourceResolution.sourceAbsolutePath, outputName)));
      }
    }
  } catch (error) {
    validationErrors.push(error instanceof Error ? error.message : String(error));
  }

  const manifestEntry: ManifestEntry = {
    entryId,
    mappingId,
    category: entry.category,
    mode: question.category,
    sourceImage: sourceResolution ? toRepoRelative(sourceResolution.sourceAbsolutePath) : "",
    sourceFilename: sourceResolution ? path.basename(sourceResolution.sourceAbsolutePath) : "",
    sourceOrigin: sourceResolution?.sourceOrigin ?? (entry.prompt ? "pollinations" : "local"),
    sourcePrompt: sourceResolution?.sourcePrompt ?? entry.prompt?.trim() ?? null,
    outputName,
    questionId: question.id,
    questionPrompt: question.q,
    answerOrDescription: question.a,
    pointTier: question.points,
    reviewNotes: entry.reviewNotes ?? "",
    outputs,
    defaultZoomOutputLabel,
    reviewStatus: "needs-fixing",
    validationErrors,
  };

  await validateManifestEntry(manifestEntry, validationErrors);
  manifestEntry.reviewStatus = validationErrors.length === 0 ? "pending-review" : "needs-fixing";
  manifestEntry.validationErrors = dedupe(validationErrors);
  return manifestEntry;
}

async function resolveSourceImage(
  entry: SourceEntry,
  outputName: string,
  requestBudget: { used: number },
): Promise<SourceResolution> {
  if (entry.source) {
    const sourceAbsolutePath = resolveWorkflowPath(entry.source);
    if (!fs.existsSync(sourceAbsolutePath)) {
      throw new Error(`Source image not found: ${entry.source}`);
    }
    return {
      sourceAbsolutePath,
      sourceOrigin: "local",
      sourcePrompt: entry.prompt?.trim() || null,
    };
  }

  const prompt = entry.prompt?.trim();
  if (!prompt) {
    throw new Error(`Entry ${entry.questionId} must provide either "source" or "prompt".`);
  }

  const sourceAbsolutePath = path.join(generatedSourceRoot, `${outputName}--source.jpg`);
  if (!force && fs.existsSync(sourceAbsolutePath)) {
    return {
      sourceAbsolutePath,
      sourceOrigin: "pollinations",
      sourcePrompt: prompt,
    };
  }

  await fetchPollinationsImage(prompt, sourceAbsolutePath, requestBudget);
  return {
    sourceAbsolutePath,
    sourceOrigin: "pollinations",
    sourcePrompt: prompt,
  };
}

async function fetchPollinationsImage(prompt: string, targetPath: string, requestBudget: { used: number }): Promise<void> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= POLLINATIONS_RETRY_ATTEMPTS; attempt += 1) {
    if (requestBudget.used >= MAX_SOURCE_IMAGE_REQUESTS_PER_RUN) {
      throw new Error(
        `Pollinations request cap reached after ${requestBudget.used} request(s). The hard cap is ${MAX_SOURCE_IMAGE_REQUESTS_PER_RUN} per run.`,
      );
    }
    requestBudget.used += 1;

    try {
      const response = await fetch(buildPollinationsUrl(prompt), {
        method: "GET",
        headers: { accept: "image/*" },
        signal: AbortSignal.timeout(POLLINATIONS_TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = truncateForError(await safeReadText(response));
        throw new Error(`Pollinations returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.startsWith("image/")) {
        const detail = truncateForError(await safeReadText(response));
        throw new Error(
          `Pollinations returned a non-image response (${contentType || "unknown content-type"})${detail ? `: ${detail}` : ""}`,
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) {
        throw new Error("Pollinations returned an empty image response");
      }

      await validateImageBuffer(buffer, `Pollinations source image for prompt "${prompt}"`);
      ensureDir(path.dirname(targetPath));
      fs.writeFileSync(targetPath, buffer);
      return;
    } catch (error) {
      lastError = normalizePollinationsError(error);
      if (attempt === POLLINATIONS_RETRY_ATTEMPTS) {
        break;
      }
    }
  }

  throw new Error(
    `Pollinations source-image generation failed for "${prompt}" after ${POLLINATIONS_RETRY_ATTEMPTS} attempt(s): ${lastError ?? "unknown error"}`,
  );
}

function buildPollinationsUrl(prompt: string): string {
  const encodedPrompt = encodeURIComponent(prompt);
  const base = pollinationsBaseUrl.endsWith("/") ? pollinationsBaseUrl : `${pollinationsBaseUrl}/`;
  return `${base}${encodedPrompt}?width=1200&height=1200&model=flux&nologo=true&private=true&safe=true`;
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
      const status = approval?.status ?? entry.reviewStatus;
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

      const validationHtml =
        entry.validationErrors.length > 0
          ? `<ul class="errors">${entry.validationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
          : `<p class="ok-note">Local checks passed. This entry is still pending manual review.</p>`;

      return `
        <article class="card" data-entry-id="${escapeHtml(entry.entryId)}" data-mapping-id="${escapeHtml(entry.mappingId)}" data-category="${escapeHtml(entry.category)}" data-question-id="${escapeHtml(entry.questionId)}" data-default-status="${escapeHtml(entry.reviewStatus)}">
          <header class="card-header">
            <div>
              <h2>${escapeHtml(entry.entryId)}</h2>
              <p>${escapeHtml(entry.category)} · ${escapeHtml(entry.sourceFilename || "missing-source")}</p>
            </div>
            <div class="status-group">
              <button type="button" class="status-button ${status === "approved" ? "active approved" : ""}" data-status="approved">Approved</button>
              <button type="button" class="status-button ${status === "pending-review" ? "active pending-review" : ""}" data-status="pending-review">Pending-review</button>
              <button type="button" class="status-button ${status === "needs-fixing" ? "active needs-fixing" : ""}" data-status="needs-fixing">Needs-fixing</button>
            </div>
          </header>
          <dl class="meta-grid">
            <div><dt>Mapping ID</dt><dd>${escapeHtml(entry.mappingId)}</dd></div>
            <div><dt>Question ID</dt><dd>${escapeHtml(entry.questionId)}</dd></div>
            <div><dt>Points</dt><dd>${escapeHtml(String(entry.pointTier))}</dd></div>
            <div><dt>Prompt</dt><dd>${escapeHtml(entry.questionPrompt)}</dd></div>
            <div><dt>Answer</dt><dd>${escapeHtml(entry.answerOrDescription)}</dd></div>
            <div><dt>Source origin</dt><dd>${escapeHtml(entry.sourceOrigin)}</dd></div>
            <div><dt>Source prompt</dt><dd>${escapeHtml(entry.sourcePrompt ?? "—")}</dd></div>
            <div><dt>Source</dt><dd>${escapeHtml(entry.sourceImage || "—")}</dd></div>
            <div><dt>Notes</dt><dd>${escapeHtml(entry.reviewNotes || "—")}</dd></div>
          </dl>
          ${validationHtml}
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
      .toolbar .summary { color: #cbd5e1; font-size: 14px; white-space: pre-line; }
      main { padding: 20px; display: grid; gap: 16px; }
      .card { background: #111827; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 20px; padding: 16px; display: grid; gap: 16px; }
      .card-header { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; }
      .card-header h2 { margin: 0 0 4px; font-size: 18px; }
      .card-header p { margin: 0; color: #94a3b8; }
      .status-group { display: flex; gap: 8px; flex-wrap: wrap; }
      .status-button { border: 1px solid rgba(148, 163, 184, 0.35); background: transparent; color: inherit; border-radius: 999px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
      .status-button.active.approved { background: #22c55e; color: #052e16; border-color: #22c55e; }
      .status-button.active.pending-review { background: #facc15; color: #422006; border-color: #facc15; }
      .status-button.active.needs-fixing { background: #f97316; color: #431407; border-color: #f97316; }
      .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0; }
      .meta-grid dt { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
      .meta-grid dd { margin: 0; white-space: pre-wrap; }
      .outputs { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .output { background: rgba(30, 41, 59, 0.65); border-radius: 16px; padding: 12px; display: grid; gap: 10px; }
      .output img { width: 100%; height: 220px; object-fit: contain; background: #020617; border-radius: 12px; }
      .output-meta { display: grid; gap: 8px; font-size: 13px; }
      .output-choice, .stage-pill { display: inline-flex; align-items: center; gap: 6px; }
      .stage-pill { font-weight: 700; color: #bfdbfe; }
      .errors { margin: 0; padding-left: 20px; color: #fdba74; }
      .ok-note { margin: 0; color: #bfdbfe; }
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

      const ensureState = (entryId, mappingId, category, questionId, defaultStatus, fallbackOutputLabel) => {
        if (!state.has(entryId)) {
          state.set(entryId, {
            entryId,
            mappingId,
            category,
            questionId,
            status: defaultStatus || "pending-review",
            selectedOutputLabel: fallbackOutputLabel || undefined
          });
        }
        return state.get(entryId);
      };

      const syncSummary = () => {
        const values = Array.from(state.values());
        const approved = values.filter((entry) => entry.status === "approved").length;
        const pending = values.filter((entry) => entry.status === "pending-review").length;
        const needsFixing = values.filter((entry) => entry.status === "needs-fixing").length;
        document.getElementById("summary").textContent =
          approved + " approved / " + pending + " pending-review / " + needsFixing + " needs-fixing / " + manifest.entries.length + " total";
        window.localStorage.setItem(storageKey, JSON.stringify({
          schemaVersion: 2,
          savedAt: new Date().toISOString(),
          entries: values
        }));
      };

      document.querySelectorAll(".card").forEach((card) => {
        const entryId = card.dataset.entryId;
        const mappingId = card.dataset.mappingId;
        const category = card.dataset.category;
        const questionId = card.dataset.questionId;
        const defaultStatus = card.dataset.defaultStatus;
        const fallbackOutputLabel = card.querySelector('input[type="radio"]')?.value;
        const entryState = ensureState(entryId, mappingId, category, questionId, defaultStatus, fallbackOutputLabel);

        card.querySelectorAll(".status-button").forEach((button) => {
          if (button.dataset.status === entryState.status) {
            button.classList.add("active", entryState.status);
          }
          button.addEventListener("click", () => {
            entryState.status = button.dataset.status;
            card.querySelectorAll(".status-button").forEach((candidate) => {
              candidate.classList.remove("active", "approved", "pending-review", "needs-fixing");
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
          schemaVersion: 2,
          savedAt: new Date().toISOString(),
          entries: manifest.entries.map((entry) => {
            const current = ensureState(entry.entryId, entry.mappingId, entry.category, entry.questionId, entry.reviewStatus, entry.defaultZoomOutputLabel || entry.outputs[0]?.label);
            return {
              entryId: entry.entryId,
              mappingId: entry.mappingId,
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

  const manifest = loadManifest();
  for (const entry of manifest.entries) {
    await validateManifestEntry(entry, errors);
  }

  for (const [questionId, asset] of Object.entries(APPROVED_ZOOM_WADDA7_ASSETS)) {
    const question = questionLookup.get(questionId);
    if (!question) {
      errors.push(`Applied mapping references missing question ID: ${questionId}`);
      continue;
    }
    if (question.category !== asset.category) {
      errors.push(`Applied mapping category mismatch for ${questionId}: expected ${question.category}, got ${asset.category}`);
    }
    if (question.q !== asset.questionPrompt) {
      errors.push(`Applied mapping prompt mismatch for ${questionId}`);
    }
    if (question.a !== asset.answerOrDescription) {
      errors.push(`Applied mapping answer mismatch for ${questionId}`);
    }
    if (question.points !== asset.pointTier) {
      errors.push(`Applied mapping points mismatch for ${questionId}: expected ${question.points}, got ${asset.pointTier}`);
    }
    await validateRepoRelativeImagePath(asset.sourceImage, `Applied source image ${questionId}`, errors);
    if (asset.category === "zoom") {
      await validateImagePath(asset.image, `Applied zoom asset ${questionId}`, errors);
    } else {
      if (asset.stages.length !== 3) {
        errors.push(`Applied wadda7 mapping ${questionId} must contain exactly 3 stages`);
      }
      for (const [index, stagePath] of asset.stages.entries()) {
        await validateImagePath(stagePath, `Applied wadda7 asset ${questionId} stage ${index}`, errors);
      }
    }
  }

  if (fs.existsSync(approvalDraftPath)) {
    const approvals = loadApprovalDraft(true);
    await validateApprovalDraft(manifest, approvals, errors);
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n- ${dedupe(errors).join("\n- ")}`);
  }

  console.log("Zoom/Wadda7 validation passed");
}

async function promoteApprovedMappings(): Promise<void> {
  const manifest = loadManifest();
  const approvals = loadApprovalDraft(true);
  const errors: string[] = [];
  await validateApprovalDraft(manifest, approvals, errors);

  if (errors.length > 0) {
    throw new Error(`Cannot promote approvals:\n- ${dedupe(errors).join("\n- ")}`);
  }

  const manifestByEntryId = new Map(manifest.entries.map((entry) => [entry.entryId, entry]));
  const approvedQuestionIds = new Set<string>();
  ensureDir(promotedGeneratedZoomDir);
  ensureDir(promotedGeneratedWadda7Dir);

  const existingPromotedPaths = new Set<string>();
  for (const asset of Object.values(APPROVED_ZOOM_WADDA7_ASSETS)) {
    if (asset.category === "zoom") {
      existingPromotedPaths.add(asset.image);
    } else {
      for (const stage of asset.stages) existingPromotedPaths.add(stage);
    }
  }

  const mappings = approvals.entries
    .filter((entry) => entry.status === "approved")
    .map((approval) => {
      const manifestEntry = manifestByEntryId.get(approval.entryId)!;
      const questionId = manifestEntry.questionId;
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
        const promotedPath = promoteGeneratedOutput(manifestEntry.category, selectedOutput.relativePath);
        return [
          questionId,
          {
            category: "zoom",
            sourceImage: manifestEntry.sourceImage,
            questionId,
            questionPrompt: manifestEntry.questionPrompt,
            answerOrDescription: manifestEntry.answerOrDescription,
            pointTier: manifestEntry.pointTier,
            image: promotedPath,
          },
        ] as const;
      }

      const orderedStages = ["stage-600", "stage-400", "stage-200"].map((label) => {
        const output = manifestEntry.outputs.find((candidate) => candidate.label === label);
        if (!output) {
          throw new Error(`Approved wadda7 mapping ${manifestEntry.entryId} is missing ${label}`);
        }
        return promoteGeneratedOutput(manifestEntry.category, output.relativePath);
      }) as [string, string, string];

      return [
        questionId,
        {
          category: "wadda7",
          sourceImage: manifestEntry.sourceImage,
          questionId,
          questionPrompt: manifestEntry.questionPrompt,
          answerOrDescription: manifestEntry.answerOrDescription,
          pointTier: manifestEntry.pointTier,
          stages: orderedStages,
        },
      ] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right, "en"));

  const nextPromotedPaths = new Set<string>();
  for (const [, asset] of mappings) {
    if (asset.category === "zoom") {
      nextPromotedPaths.add(asset.image);
    } else {
      for (const stage of asset.stages) nextPromotedPaths.add(stage);
    }
  }
  for (const publicRelativePath of existingPromotedPaths) {
    if (nextPromotedPaths.has(publicRelativePath)) continue;
    const absolutePath = resolvePublicImagePath(publicRelativePath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { force: true });
    }
  }

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
  console.log(`Promoted ${mappings.length} approved mappings into client/public/images/generated/ and ${toRepoRelative(appliedMappingPath)}`);
}

async function validateApprovalDraft(manifest: GeneratedManifest, approvals: ApprovalFile, errors: string[]): Promise<void> {
  const manifestByEntryId = new Map(manifest.entries.map((entry) => [entry.entryId, entry]));
  const approvedQuestionIds = new Set<string>();

  for (const approval of approvals.entries) {
    if (!approval.entryId || !approval.mappingId || !approval.questionId) {
      errors.push(`Approval entries must include entryId, mappingId, and questionId`);
      continue;
    }
    if (!["approved", "pending-review", "needs-fixing"].includes(approval.status)) {
      errors.push(`Approval ${approval.entryId} has invalid status ${approval.status}`);
      continue;
    }

    if (approval.status !== "approved") {
      continue;
    }

    const manifestEntry = manifestByEntryId.get(approval.entryId);
    if (!manifestEntry) {
      errors.push(`Approval references missing manifest entry: ${approval.entryId}`);
      continue;
    }
    if (manifestEntry.mappingId !== approval.mappingId) {
      errors.push(`Approval mappingId mismatch for ${approval.entryId}: expected ${manifestEntry.mappingId}, got ${approval.mappingId}`);
    }
    if (manifestEntry.questionId !== approval.questionId) {
      errors.push(`Approval questionId mismatch for ${approval.entryId}: expected ${manifestEntry.questionId}, got ${approval.questionId}`);
    }
    if (manifestEntry.validationErrors.length > 0) {
      errors.push(`Approved entry ${approval.entryId} still has local validation errors`);
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
        await validateRepoRelativeImagePath(selectedOutput.relativePath, `Approved zoom entry ${approval.entryId}`, errors);
      }
    } else {
      for (const label of ["stage-600", "stage-400", "stage-200"]) {
        const stage = manifestEntry.outputs.find((output) => output.label === label);
        if (!stage) {
          errors.push(`Approved wadda7 entry ${approval.entryId} is missing ${label}`);
          continue;
        }
        await validateRepoRelativeImagePath(stage.relativePath, `Approved wadda7 entry ${approval.entryId} ${label}`, errors);
      }
    }
  }
}

async function validateManifestEntry(entry: ManifestEntry, errors: string[]): Promise<void> {
  if (!entry.entryId) {
    errors.push("Manifest entry is missing entryId");
  }
  if (!entry.mappingId) {
    errors.push(`Manifest entry ${entry.entryId || "(unknown)"} is missing mappingId`);
  }
  const question = questionLookup.get(entry.questionId);
  if (!question) {
    errors.push(`Manifest entry ${entry.entryId} references missing question ID ${entry.questionId}`);
    return;
  }
  if (entry.mode !== question.category) {
    errors.push(`Manifest entry ${entry.entryId} mode mismatch: expected ${question.category}, got ${entry.mode}`);
  }
  if (entry.category !== question.category) {
    errors.push(`Manifest entry ${entry.entryId} category mismatch: expected ${question.category}, got ${entry.category}`);
  }
  if (entry.questionPrompt !== question.q) {
    errors.push(`Manifest entry ${entry.entryId} prompt mismatch for ${entry.questionId}`);
  }
  if (entry.answerOrDescription !== question.a) {
    errors.push(`Manifest entry ${entry.entryId} answer mismatch for ${entry.questionId}`);
  }
  if (entry.pointTier !== question.points) {
    errors.push(`Manifest entry ${entry.entryId} points mismatch: expected ${question.points}, got ${entry.pointTier}`);
  }
  if (!entry.sourceImage) {
    errors.push(`Manifest entry ${entry.entryId} is missing sourceImage`);
  } else {
    await validateRepoRelativeImagePath(entry.sourceImage, `Manifest source image ${entry.entryId}`, errors);
  }

  if (entry.category === "zoom") {
    const expectedLabels = ["close-1", "close-2", "close-3"];
    for (const label of expectedLabels) {
      const output = entry.outputs.find((candidate) => candidate.label === label);
      if (!output) {
        errors.push(`Manifest zoom entry ${entry.entryId} is missing ${label}`);
        continue;
      }
      await validateRepoRelativeImagePath(output.relativePath, `Manifest zoom entry ${entry.entryId} ${label}`, errors);
    }
  } else {
    const expectedLabels = ["stage-600", "stage-400", "stage-200"];
    for (const label of expectedLabels) {
      const output = entry.outputs.find((candidate) => candidate.label === label);
      if (!output) {
        errors.push(`Manifest wadda7 entry ${entry.entryId} is missing ${label}`);
        continue;
      }
      await validateRepoRelativeImagePath(output.relativePath, `Manifest wadda7 entry ${entry.entryId} ${label}`, errors);
    }
  }

  if (entry.reviewStatus === "approved") {
    errors.push(`Manifest entry ${entry.entryId} must not be auto-approved; use pending-review until manual review is completed`);
  }
}

async function validateImagePath(publicRelativePath: string, label: string, errors: string[]): Promise<void> {
  if (!publicRelativePath.startsWith("./images/")) {
    errors.push(`${label} must stay under ./images/, got ${publicRelativePath}`);
    return;
  }
  const absolutePath = path.join(publicImagesRoot, publicRelativePath.replace("./images/", ""));
  await validateAbsoluteImageFile(absolutePath, `${label} (${publicRelativePath})`, errors);
}

async function validateRepoRelativeImagePath(repoRelativePath: string, label: string, errors: string[]): Promise<void> {
  if (!repoRelativePath) {
    errors.push(`${label} is missing`);
    return;
  }
  const absolutePath = path.join(repoRoot, repoRelativePath);
  await validateAbsoluteImageFile(absolutePath, `${label} (${repoRelativePath})`, errors);
}

async function validateAbsoluteImageFile(absolutePath: string, label: string, errors: string[]): Promise<void> {
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${label} points at a missing image`);
    return;
  }

  const stat = fs.statSync(absolutePath);
  if (stat.size === 0) {
    errors.push(`${label} is empty`);
    return;
  }

  try {
    const metadata = await sharp(absolutePath).metadata();
    if (!metadata.width || !metadata.height) {
      errors.push(`${label} has invalid image metadata`);
    }
  } catch (error) {
    errors.push(`${label} is not a valid image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateImageBuffer(buffer: Buffer, label: string): Promise<void> {
  if (buffer.byteLength === 0) {
    throw new Error(`${label} is empty`);
  }
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${label} has invalid image metadata`);
  }
}

async function generateZoomOutputs(entry: SourceEntry, sourcePath: string, outputName: string): Promise<ManifestOutput[]> {
  const image = sharp(sourcePath).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${toRepoRelative(sourcePath)}`);
  }

  const crops = buildZoomCrops(metadata.width, metadata.height, entry.zoom?.manualCrop);
  const labels = ["close-1", "close-2", "close-3"] as const;
  const outputs: ManifestOutput[] = [];

  for (const [index, crop] of crops.entries()) {
    const filename = `${outputName}--${labels[index]}.jpg`;
    const absolutePath = path.join(stagedGeneratedZoomDir, filename);
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
    throw new Error(`Could not derive resized dimensions for ${toRepoRelative(sourcePath)}`);
  }

  const variants: Array<{ label: "stage-600" | "stage-400" | "stage-200"; pixelateTo?: number; blur?: number }> = [
    { label: "stage-600", pixelateTo: 40, blur: 2.8 },
    { label: "stage-400", pixelateTo: 110, blur: 1.1 },
    { label: "stage-200" },
  ];

  const outputs: ManifestOutput[] = [];

  for (const variant of variants) {
    const filename = `${outputName}--${variant.label}.jpg`;
    const absolutePath = path.join(stagedGeneratedWadda7Dir, filename);
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

function resolveQuestion(entry: SourceEntry): QuestionLookup {
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
  for (const [index, entry] of config.entries.entries()) {
    if (!entry.questionId) {
      throw new Error(`source-images.json entry ${index} is missing questionId`);
    }
    if (!entry.category || (entry.category !== "zoom" && entry.category !== "wadda7")) {
      throw new Error(`source-images.json entry ${index} must use category "zoom" or "wadda7"`);
    }
    if ((entry.source ? 1 : 0) + (entry.prompt ? 1 : 0) !== 1) {
      throw new Error(`source-images.json entry ${index} must include exactly one of "source" or "prompt"`);
    }
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
      throw new Error(`Save the downloaded review approval file to ${toRepoRelative(approvalDraftPath)} before promoting.`);
    }
    return { schemaVersion: 2, savedAt: new Date(0).toISOString(), entries: [] };
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

function resolvePublicImagePath(publicRelativePath: string): string {
  if (!publicRelativePath.startsWith("./images/")) {
    throw new Error(`Public image path must stay under ./images/, got ${publicRelativePath}`);
  }
  return path.join(publicImagesRoot, publicRelativePath.replace("./images/", ""));
}

function promoteGeneratedOutput(category: WorkflowCategory, stagedRepoRelativePath: string): string {
  const sourceAbsolutePath = path.join(repoRoot, stagedRepoRelativePath);
  if (!fs.existsSync(sourceAbsolutePath)) {
    throw new Error(`Approved ${category} output is missing: ${stagedRepoRelativePath}`);
  }
  const targetDir = category === "zoom" ? promotedGeneratedZoomDir : promotedGeneratedWadda7Dir;
  const targetAbsolutePath = path.join(targetDir, path.basename(stagedRepoRelativePath));
  ensureDir(path.dirname(targetAbsolutePath));
  fs.copyFileSync(sourceAbsolutePath, targetAbsolutePath);
  return toPublicRelative(toRepoRelative(targetAbsolutePath));
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

function getFlagValue(prefix: string): string | null {
  const arg = process.argv.find((candidate) => candidate.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function countPlannedSourceImageRequests(entries: SourceEntry[]): number {
  return entries.filter((entry) => {
    if (!entry.prompt) return false;
    const question = resolveQuestion(entry);
    const outputName = slugify(entry.outputName || question.id);
    const sourceAbsolutePath = path.join(generatedSourceRoot, `${outputName}--source.jpg`);
    return force || !fs.existsSync(sourceAbsolutePath);
  }).length;
}

function printDryRunPlan(entries: SourceEntry[], requestPlanCount: number): void {
  const plan = entries.map((entry) => {
    const question = resolveQuestion(entry);
    const outputName = slugify(entry.outputName || question.id);
    const sourceAbsolutePath = entry.source
      ? resolveWorkflowPath(entry.source)
      : path.join(generatedSourceRoot, `${outputName}--source.jpg`);
    return {
      mappingId: slugify(entry.mappingId || `${entry.category}-${question.id}-${outputName}`),
      mode: entry.category,
      questionId: question.id,
      promptFromSeed: question.q,
      answerFromSeed: question.a,
      pointsFromSeed: question.points,
      sourceOrigin: entry.source ? "local" : "pollinations",
      sourceImage: toRepoRelative(sourceAbsolutePath),
      sourcePrompt: entry.prompt ?? null,
      wouldFetchPollinations: !entry.source && (force || !fs.existsSync(sourceAbsolutePath)),
      outputs:
        entry.category === "zoom"
          ? ["close-1", "close-2", "close-3"].map((label) => `local-workflows/zoom-wadda7/output/generated/zoom/${outputName}--${label}.jpg`)
          : ["stage-600", "stage-400", "stage-200"].map((label) => `local-workflows/zoom-wadda7/output/generated/wadda7/${outputName}--${label}.jpg`),
    };
  });

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        networkUsed: false,
        filesWritten: false,
        plannedSourceImageRequests: requestPlanCount,
        hardCap: MAX_SOURCE_IMAGE_REQUESTS_PER_RUN,
        entries: plan,
      },
      null,
      2,
    ),
  );
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function truncateForError(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function normalizePollinationsError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return `request timed out after ${POLLINATIONS_TIMEOUT_MS}ms`;
    }
    return error.message;
  }
  return String(error);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
