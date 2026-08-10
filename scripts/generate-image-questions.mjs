import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const repoRoot = process.cwd();
const sourceImagesDir = resolve(repoRoot, 'source-images');
const reviewDir = resolve(repoRoot, 'artifacts/image-review');
const reviewGeneratedDir = resolve(reviewDir, 'generated');
const tempGenerationDir = resolve(repoRoot, 'tmp/image-generation');
const publicImagesDir = resolve(repoRoot, 'client/public/images');
const mappingsPath = resolve(reviewDir, 'mappings.json');
const manifestPath = resolve(reviewDir, 'generated-review-manifest.json');
const questionsFile = resolve(repoRoot, 'client/src/data/questions.ts');
const overwrite = process.argv.includes('--overwrite');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function toRepoRelative(targetPath) {
  return relative(repoRoot, targetPath).split('\\').join('/');
}

function parseQuestionMetadata(source) {
  const categoryBlocks = [...source.matchAll(/key:\s*"(zoom|wadda7)"([\s\S]*?)(?=\n\s*key:\s*"|\n\s*\]\s*,?\s*$)/g)];
  const results = [];
  for (const [, categoryKey, block] of categoryBlocks) {
    const matches = [...block.matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*points:\s*(\d+)\s*,\s*q:\s*"([^"]+)"\s*,\s*a:\s*"([^"]+)"/g)];
    for (const match of matches) {
      results.push({ questionId: match[1], points: Number(match[2]), questionPrompt: match[3], arabicAnswer: match[4], mode: categoryKey });
    }
  }
  return results;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function ensureFileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function listSourceImages(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceImages(full));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function writeImage(outputPath, image) {
  await ensureDir(join(outputPath, '..'));
  await image.toFile(outputPath);
}

async function createZoomOutputs(inputPath, outputDir, overwriteExisting) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const width = metadata.width || 1200;
  const height = metadata.height || 1200;
  const cropWidth = Math.max(320, Math.round(width * 0.6));
  const cropHeight = Math.max(320, Math.round(height * 0.6));
  const presets = [
    { name: 'crop-1', left: Math.round(width * 0.16), top: Math.round(height * 0.12) },
    { name: 'crop-2', left: Math.round(width * 0.26), top: Math.round(height * 0.32) },
    { name: 'crop-3', left: Math.round(width * 0.36), top: Math.round(height * 0.18) },
  ];
  const outputs = [];
  for (const preset of presets) {
    const outputPath = join(outputDir, `${preset.name}.jpg`);
    const fileExists = await ensureFileExists(outputPath);
    if (fileExists && !overwriteExisting) {
      outputs.push({ name: preset.name, path: toRepoRelative(outputPath), skipped: true });
      continue;
    }
    await writeImage(outputPath, sharp(inputPath).extract({ left: preset.left, top: preset.top, width: cropWidth, height: cropHeight }).resize(900, 900, { fit: 'cover' }).jpeg({ quality: 90 }));
    outputs.push({ name: preset.name, path: toRepoRelative(outputPath), skipped: false });
  }
  return outputs;
}

async function createWadda7Outputs(inputPath, outputDir, overwriteExisting) {
  const presets = [
    { name: 'stage-1', transform: (img) => img.blur(18).pixelate(18).jpeg({ quality: 82 }) },
    { name: 'stage-2', transform: (img) => img.blur(8).jpeg({ quality: 86 }) },
    { name: 'stage-3', transform: (img) => img.jpeg({ quality: 92 }) },
  ];
  const outputs = [];
  for (const preset of presets) {
    const outputPath = join(outputDir, `${preset.name}.jpg`);
    const fileExists = await ensureFileExists(outputPath);
    if (fileExists && !overwriteExisting) {
      outputs.push({ name: preset.name, path: toRepoRelative(outputPath), skipped: true });
      continue;
    }
    await writeImage(outputPath, preset.transform(sharp(inputPath).resize(1100, 1100, { fit: 'cover' })));
    outputs.push({ name: preset.name, path: toRepoRelative(outputPath), skipped: false });
  }
  return outputs;
}

async function writeReviewHtml(manifest) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Image Question Review</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; background: #f7f7f7; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
      .card { background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 6px 18px rgba(0,0,0,.08); }
      .card.invalid { border: 2px solid #c62828; }
      img { width: 100%; height: auto; border-radius: 8px; margin-bottom: 0.5rem; }
      .pill { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.8rem; margin-bottom: 0.5rem; }
      .approved { background: #e8f5e9; color: #1b5e20; }
      .needs-fixing { background: #ffebee; color: #b71c1c; }
      .pending { background: #fff3e0; color: #e65100; }
      .invalid { background: #fff3f3; color: #b71c1c; }
      .error { color: #b71c1c; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>Image Question Review</h1>
    <p>Review each mapping, confirm the image matches the Arabic description, and then update the mapping status.</p>
    <div class="grid">
      ${manifest.map((entry) => `
        <div class="card ${entry.isInvalid ? 'invalid' : ''}">
          <div class="pill ${entry.isInvalid ? 'invalid' : entry.status === 'approved' ? 'approved' : entry.status === 'needs-fixing' ? 'needs-fixing' : 'pending'}">${entry.isInvalid ? 'invalid' : entry.status}</div>
          <h3>${escapeHtml(entry.questionId || 'missing')}</h3>
          <p><strong>Mode:</strong> ${escapeHtml(entry.mode || 'unknown')}</p>
          <p><strong>Prompt:</strong> ${escapeHtml(entry.questionPrompt || 'missing')}</p>
          <p><strong>Answer:</strong> ${escapeHtml(entry.arabicAnswer || 'missing')}</p>
          <p><strong>Points:</strong> ${escapeHtml(entry.pointTier || 'missing')}</p>
          <p><strong>Source:</strong> ${escapeHtml(entry.sourceImage || 'missing')}</p>
          ${entry.reviewImageUrl ? `<img src="${entry.reviewImageUrl}" alt="${escapeHtml(entry.questionId || 'review')}" />` : '<p class="error">No review image available.</p>'}
          <p><strong>Outputs:</strong></p>
          ${entry.generatedOutputs.length > 0 ? `<ul>${entry.generatedOutputs.map((output) => `<li><a href="${output.path}">${escapeHtml(output.name)}</a></li>`).join('')}</ul>` : '<p class="error">No generated outputs.</p>'}
          ${entry.reason ? `<p class="error">${escapeHtml(entry.reason)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  </body>
</html>`;
  await writeFile(join(reviewDir, 'index.html'), html);
}

async function main() {
  await ensureDir(reviewDir);
  await ensureDir(reviewGeneratedDir);
  await ensureDir(tempGenerationDir);
  await ensureDir(publicImagesDir);

  const mappingsRaw = await readFile(mappingsPath, 'utf8').catch(() => '[]');
  const mappings = JSON.parse(mappingsRaw);
  const questionsSource = await readFile(questionsFile, 'utf8');
  const questionMetadata = parseQuestionMetadata(questionsSource);
  const allowedQuestionIds = new Set(questionMetadata.map((question) => question.questionId));
  const questionById = new Map(questionMetadata.map((question) => [question.questionId, question]));
  const manifest = [];

  for (const mapping of mappings) {
    const question = mapping.questionId ? questionById.get(mapping.questionId) : null;
    const resolvedMode = question?.mode || mapping.mode || 'unknown';
    const resolvedPrompt = question?.questionPrompt || mapping.questionPrompt || '';
    const resolvedAnswer = question?.arabicAnswer || mapping.arabicAnswer || '';
    const resolvedPoints = question?.points ?? mapping.points ?? '';

    if (!mapping.questionId || !mapping.sourceImage || !resolvedMode || !resolvedPrompt || !resolvedAnswer || resolvedPoints === '') {
      manifest.push({
        questionId: mapping.questionId || 'missing',
        mode: resolvedMode,
        pointTier: resolvedPoints || 'missing',
        questionPrompt: resolvedPrompt,
        arabicAnswer: resolvedAnswer,
        status: 'needs-fixing',
        sourceImage: mapping.sourceImage || 'missing',
        reviewImageUrl: '',
        publicAssetPath: null,
        generatedOutputs: [],
        reason: 'Mapping is missing required question metadata or source image.',
        isInvalid: true,
      });
      continue;
    }

    const sourceImagePath = resolve(repoRoot, mapping.sourceImage);
    const exists = await ensureFileExists(sourceImagePath);
    if (!exists) {
      manifest.push({
        questionId: mapping.questionId,
        mode: resolvedMode,
        pointTier: resolvedPoints,
        questionPrompt: resolvedPrompt,
        arabicAnswer: resolvedAnswer,
        status: 'needs-fixing',
        sourceImage: mapping.sourceImage,
        reviewImageUrl: '',
        publicAssetPath: null,
        generatedOutputs: [],
        reason: 'Source image missing',
        isInvalid: true,
      });
      continue;
    }

    const sourceStem = slugify(mapping.sourceImage.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'source');
    const reviewEntryDir = resolve(reviewGeneratedDir, `${sourceStem}-${mapping.questionId}`);
    await ensureDir(reviewEntryDir);

    const publicModeDir = resolve(publicImagesDir, resolvedMode);
    await ensureDir(publicModeDir);

    let generatedOutputs = [];
    if (resolvedMode === 'zoom') {
      generatedOutputs = await createZoomOutputs(sourceImagePath, reviewEntryDir, overwrite);
    } else if (resolvedMode === 'wadda7') {
      generatedOutputs = await createWadda7Outputs(sourceImagePath, reviewEntryDir, overwrite);
    } else {
      manifest.push({
        questionId: mapping.questionId,
        mode: resolvedMode,
        pointTier: resolvedPoints,
        questionPrompt: resolvedPrompt,
        arabicAnswer: resolvedAnswer,
        status: 'needs-fixing',
        sourceImage: mapping.sourceImage,
        reviewImageUrl: '',
        publicAssetPath: null,
        generatedOutputs: [],
        reason: 'Mode is not supported for review generation.',
        isInvalid: true,
      });
      continue;
    }

    if (generatedOutputs.length === 0) {
      manifest.push({
        questionId: mapping.questionId,
        mode: resolvedMode,
        pointTier: resolvedPoints,
        questionPrompt: resolvedPrompt,
        arabicAnswer: resolvedAnswer,
        status: 'needs-fixing',
        sourceImage: mapping.sourceImage,
        reviewImageUrl: '',
        publicAssetPath: null,
        generatedOutputs: [],
        reason: 'Generated output metadata is missing.',
        isInvalid: true,
      });
      continue;
    }

    let selectedPublicAsset = null;
    if (mapping.status === 'approved') {
      const chosenVariant = generatedOutputs.find((output) => output.name === 'crop-1' || output.name === 'stage-3') || generatedOutputs[0];
      const publicAssetPath = resolve(publicModeDir, `${mapping.questionId}-${sourceStem}-${chosenVariant.name}.jpg`);
      const assetExists = await ensureFileExists(publicAssetPath);
      if (!assetExists || overwrite) {
        await sharp(resolve(reviewEntryDir, `${chosenVariant.name}.jpg`)).toFile(publicAssetPath);
      }
      selectedPublicAsset = toRepoRelative(publicAssetPath);
    }

    const reviewImage = generatedOutputs[0] ? resolve(reviewEntryDir, `${generatedOutputs[0].name}.jpg`) : null;
    const reviewImageUrl = reviewImage ? toRepoRelative(reviewImage) : '';
    manifest.push({
      questionId: mapping.questionId,
      mode: resolvedMode,
      pointTier: resolvedPoints,
      questionPrompt: resolvedPrompt,
      arabicAnswer: resolvedAnswer,
      status: mapping.status || 'pending-review',
      sourceImage: mapping.sourceImage,
      reviewImageUrl,
      publicAssetPath: selectedPublicAsset,
      generatedOutputs: generatedOutputs.map((output) => ({ name: output.name, path: toRepoRelative(resolve(reviewEntryDir, `${output.name}.jpg`)) })),
      reason: '',
      isInvalid: false,
    });
  }

  const validApproved = manifest.filter((entry) => entry.status === 'approved');
  const invalidApproved = validApproved.filter((entry) => !allowedQuestionIds.has(entry.questionId));
  if (invalidApproved.length > 0) {
    throw new Error(`Approved mappings reference missing question IDs: ${invalidApproved.map((entry) => entry.questionId).join(', ')}`);
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await writeReviewHtml(manifest);
  console.log(JSON.stringify({ generated: manifest.length, reviewManifest: toRepoRelative(manifestPath), reviewGallery: toRepoRelative(join(reviewDir, 'index.html')) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
