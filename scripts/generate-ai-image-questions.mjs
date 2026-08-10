import { mkdir, readFile, writeFile, access, readdir, stat } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import sharp from 'sharp';

const repoRoot = process.cwd();
const seedsPath = resolve(repoRoot, 'scripts/ai-image-question-seeds.json');
const reviewDir = resolve(repoRoot, 'artifacts/image-review');
const generatedDir = resolve(reviewDir, 'generated-ai');
const tempDir = resolve(repoRoot, 'tmp/ai-image-generation');
const mappingsPath = resolve(reviewDir, 'ai-image-mappings.json');
const reviewReportPath = resolve(reviewDir, 'ai-image-review.html');
const verifyResultsPath = resolve(reviewDir, 'ai-image-verify.json');
const defaultCap = 10;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const capArg = args.find((arg) => arg.startsWith('--cap='));
const cap = capArg ? Number(capArg.split('=')[1]) : defaultCap;

function toRepoRelative(targetPath) {
  return relative(repoRoot, targetPath).split('\\').join('/');
}

async function fileExists(filePath) {
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

function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function callOpenAIImages(prompt) {
  if (!isOpenAIConfigured()) {
    throw new Error('OPENAI_API_KEY is not set.');
  }
  if (dryRun) {
    return { dryRun: true, prompt };
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI image generation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const imageB64 = data?.data?.[0]?.b64_json;
  if (!imageB64) {
    throw new Error('OpenAI returned no image payload.');
  }
  return { dryRun: false, imageB64 };
}

async function writeImageBuffer(buffer, outputPath) {
  await ensureDir(join(outputPath, '..'));
  await writeFile(outputPath, buffer);
}

async function createZoomOutputs(inputPath, outputDir) {
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
    await sharp(inputPath).extract({ left: preset.left, top: preset.top, width: cropWidth, height: cropHeight }).resize(900, 900, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(outputPath);
    outputs.push({ name: preset.name, path: toRepoRelative(outputPath) });
  }
  return outputs;
}

async function createWadda7Outputs(inputPath, outputDir) {
  const presets = [
    { name: 'stage-1', transform: (img) => img.blur(18).pixelate(18).jpeg({ quality: 82 }) },
    { name: 'stage-2', transform: (img) => img.blur(8).jpeg({ quality: 86 }) },
    { name: 'stage-3', transform: (img) => img.jpeg({ quality: 92 }) },
  ];
  const outputs = [];
  for (const preset of presets) {
    const outputPath = join(outputDir, `${preset.name}.jpg`);
    await preset.transform(sharp(inputPath).resize(1100, 1100, { fit: 'cover' })).toFile(outputPath);
    outputs.push({ name: preset.name, path: toRepoRelative(outputPath) });
  }
  return outputs;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function main() {
  await ensureDir(reviewDir);
  await ensureDir(generatedDir);
  await ensureDir(tempDir);

  const seedsRaw = await readFile(seedsPath, 'utf8');
  const seeds = JSON.parse(seedsRaw);
  const items = seeds.slice(0, Math.max(1, cap));
  const mappings = [];
  const verificationResults = [];

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, plannedCalls: items.length, cap, apiKeyConfigured: isOpenAIConfigured() }, null, 2));
    return;
  }

  for (const item of items) {
    const itemDir = resolve(generatedDir, item.questionId);
    await ensureDir(itemDir);
    const sourcePath = resolve(itemDir, 'source.png');
    const generationResult = await callOpenAIImages(item.imagePrompt);
    if (!generationResult.dryRun) {
      const base64 = generationResult.imageB64;
      const buffer = Buffer.from(base64, 'base64');
      await writeImageBuffer(buffer, sourcePath);
    } else {
      await writeFile(sourcePath, '');
    }

    const outputs = item.mode === 'zoom' ? await createZoomOutputs(sourcePath, itemDir) : await createWadda7Outputs(sourcePath, itemDir);
    mappings.push({
      questionId: item.questionId,
      mode: item.mode,
      status: 'pending-review',
      sourceImage: toRepoRelative(sourcePath),
      questionPrompt: item.prompt,
      arabicAnswer: item.answer,
      points: item.points,
      generatedOutputs: outputs,
      sourceExists: await fileExists(sourcePath),
    });
  }

  await writeFile(mappingsPath, JSON.stringify(mappings, null, 2));
  await writeFile(verifyResultsPath, JSON.stringify(verificationResults, null, 2));

  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>AI Image Review</title><style>body{font-family:Arial,sans-serif;margin:2rem}img{max-width:100%;height:auto;border:1px solid #ddd;padding:8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body><h1>AI Image Review</h1><p>Generated source images and outputs are stored under artifacts/image-review/generated-ai/.</p><table><tr><th>Question</th><th>Answer</th><th>Source</th><th>Outputs</th><th>Decision</th><th>Explanation</th></tr>${mappings.map((item) => `<tr><td>${escapeHtml(item.questionId)}</td><td>${escapeHtml(item.arabicAnswer)}</td><td>${escapeHtml(item.sourceImage)}</td><td>${item.generatedOutputs.map((output) => `<a href="${escapeHtml(output.path)}">${escapeHtml(output.name)}</a>`).join(', ')}</td><td>pending-review</td><td>Awaiting verification.</td></tr>`).join('')}</table></body></html>`;
  await writeFile(reviewReportPath, html);

  console.log(JSON.stringify({ generated: mappings.length, reviewReport: toRepoRelative(reviewReportPath), mappings: toRepoRelative(mappingsPath) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
