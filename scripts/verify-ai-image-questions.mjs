import { readFile, writeFile, access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const mock = args.includes('--mock');
const reviewDir = resolve(repoRoot, 'artifacts/image-review');
const mappingsPath = resolve(reviewDir, 'ai-image-mappings.json');
const outputPath = resolve(reviewDir, 'ai-image-verify.json');
const seedsPath = resolve(repoRoot, 'scripts/ai-image-question-seeds.json');

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getRequiredOutputs(mode) {
  return mode === 'zoom' ? ['crop-1.jpg', 'crop-2.jpg', 'crop-3.jpg'] : ['stage-1.jpg', 'stage-2.jpg', 'stage-3.jpg'];
}

async function callOpenAIVision(imagePath) {
  if (!isOpenAIConfigured()) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [{
        role: 'system',
        content: 'You inspect a generated image and return strict JSON.'
      }, {
        role: 'user',
        content: [
          { type: 'text', text: 'Inspect this image. Return JSON with fields: questionId, expectedArabicAnswer, mainSubjectMatchesAnswer (boolean), confidence (number 0-1), hasText (boolean), hasWatermark (boolean), hasLogo (boolean), hasConflictingSubject (boolean), hasUnclearSubject (boolean), explanationArabic (string). Do not include markdown.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } }
        ]
      }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI vision failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return { provider: 'openai', ...JSON.parse(content) };
}

function buildVerificationResult(seed, vision, approved, reason, missingPaths = []) {
  return {
    questionId: seed.questionId,
    expectedArabicAnswer: seed.answer,
    confidence: vision.confidence,
    mainSubjectMatchesAnswer: vision.mainSubjectMatchesAnswer,
    hasText: vision.hasText,
    hasWatermark: vision.hasWatermark,
    hasLogo: vision.hasLogo,
    hasConflictingSubject: vision.hasConflictingSubject,
    hasUnclearSubject: vision.hasUnclearSubject,
    approved,
    explanationArabic: vision.explanationArabic || '',
    reason,
    missingPaths,
  };
}

async function runVerification({ repoRootPath, reviewDirPath, mappingsFilePath, outputFilePath, seedsFilePath, dryRunMode, mockMode }) {
  const seedsRaw = await readFile(seedsFilePath, 'utf8');
  const seeds = JSON.parse(seedsRaw);
  const mappingsRaw = await readFile(mappingsFilePath, 'utf8').catch(() => null);
  const mappings = mappingsRaw ? JSON.parse(mappingsRaw) : [];
  const results = [];

  if (dryRunMode) {
    const plannedOperations = [];
    const missingInputs = [];

    for (const seed of seeds) {
      const mapping = mappings.find((entry) => entry.questionId === seed.questionId);
      if (!mapping) {
        missingInputs.push({ questionId: seed.questionId, reason: 'missing mapping entry' });
        continue;
      }

      const sourcePath = resolve(repoRootPath, mapping.sourceImage);
      const requiredOutputs = getRequiredOutputs(seed.mode);
      const outputPaths = requiredOutputs.map((fileName) => resolve(reviewDirPath, 'generated-ai', seed.questionId, fileName));
      const sourceExists = await fileExists(sourcePath);
      const outputExists = await Promise.all(outputPaths.map((filePath) => fileExists(filePath)));
      const missingPaths = [];
      if (!sourceExists) missingPaths.push(sourcePath);
      outputPaths.forEach((filePath, index) => {
        if (!outputExists[index]) missingPaths.push(filePath);
      });

      plannedOperations.push({
        questionId: seed.questionId,
        mode: seed.mode,
        checks: [
          'mapping entry exists',
          'source image exists',
          'every required generated output exists',
          'vision response passes confidence >= 0.95',
          'vision response passes rejection checks',
        ],
        status: missingPaths.length > 0 ? 'blocked' : 'planned',
      });
      if (missingPaths.length > 0) {
        missingInputs.push({ questionId: seed.questionId, missingPaths });
      }
    }

    const summary = {
      dryRun: true,
      plannedVerifications: plannedOperations.length,
      plannedOperations,
      expectedValidationChecks: [
        'source image must exist',
        'every required generated output must exist',
        'vision confidence must be >= 0.95',
        'vision must not contain text, watermark, logo, conflicting subject, or unclear subject',
      ],
      missingInputs,
    };

    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = missingInputs.length > 0 ? 1 : 0;
    return;
  }

  let fixtureRoot = null;
  let activeRepoRoot = repoRootPath;
  let activeReviewDir = reviewDirPath;
  let activeMappingsFile = mappingsFilePath;
  let activeOutputFile = outputFilePath;

  if (mockMode) {
    fixtureRoot = await mkdtemp(resolve(tmpdir(), 'ai-image-verify-mock-'));
    activeRepoRoot = fixtureRoot;
    activeReviewDir = resolve(fixtureRoot, 'artifacts/image-review');
    activeMappingsFile = resolve(activeReviewDir, 'ai-image-mappings.json');
    activeOutputFile = resolve(activeReviewDir, 'ai-image-verify.json');
    await mkdir(activeReviewDir, { recursive: true });
  }

  try {
    const fixtureMappings = [];
    for (const seed of seeds) {
      const mapping = mappings.find((entry) => entry.questionId === seed.questionId);
      if (!mapping) {
        continue;
      }

      const requiredOutputs = getRequiredOutputs(seed.mode);
      const outputPaths = requiredOutputs.map((fileName) => resolve(activeReviewDir, 'generated-ai', seed.questionId, fileName));
      const sourcePath = resolve(activeRepoRoot, mapping.sourceImage);

      if (mockMode) {
        await mkdir(resolve(activeReviewDir, 'generated-ai', seed.questionId), { recursive: true });
        if (seed.questionId === 'zoom-16') {
          await writeFile(sourcePath, 'placeholder');
          await writeFile(outputPaths[0], 'placeholder');
          await writeFile(outputPaths[1], 'placeholder');
        } else {
          await writeFile(sourcePath, 'placeholder');
          outputPaths.forEach((filePath) => writeFile(filePath, 'placeholder'));
        }
      }

      const sourceExists = await fileExists(sourcePath);
      const outputExists = await Promise.all(outputPaths.map((filePath) => fileExists(filePath)));
      const missingPaths = [];
      if (!sourceExists) missingPaths.push(sourcePath);
      outputPaths.forEach((filePath, index) => {
        if (!outputExists[index]) missingPaths.push(filePath);
      });

      if (missingPaths.length > 0) {
        const verification = buildVerificationResult(seed, {
          confidence: 0,
          mainSubjectMatchesAnswer: false,
          hasText: false,
          hasWatermark: false,
          hasLogo: false,
          hasConflictingSubject: false,
          hasUnclearSubject: false,
          explanationArabic: 'Missing source image or generated outputs.',
        }, false, 'needs-fixing', missingPaths);
        results.push(verification);
        fixtureMappings.push({
          questionId: seed.questionId,
          mode: seed.mode,
          status: 'needs-fixing',
          sourceImage: mapping.sourceImage,
          questionPrompt: seed.prompt,
          arabicAnswer: seed.answer,
          points: seed.points,
          verification,
        });
        continue;
      }

      const vision = mockMode
        ? {
            provider: 'mock',
            confidence: 0.97,
            mainSubjectMatchesAnswer: true,
            hasText: false,
            hasWatermark: false,
            hasLogo: false,
            hasConflictingSubject: false,
            hasUnclearSubject: false,
            explanationArabic: 'Mock fixture response.',
          }
        : await callOpenAIVision(sourcePath);

      const approved = vision.provider === 'openai' && vision.confidence >= 0.95 && !vision.hasText && !vision.hasWatermark && !vision.hasLogo && !vision.hasConflictingSubject && !vision.hasUnclearSubject && outputExists.every(Boolean) && mapping.mode === seed.mode && mapping.questionPrompt === seed.prompt && mapping.arabicAnswer === seed.answer && Number(mapping.points) === seed.points;
      const verification = buildVerificationResult(seed, vision, approved, approved ? 'approved' : 'needs-fixing', []);
      results.push(verification);
      fixtureMappings.push({
        questionId: seed.questionId,
        mode: seed.mode,
        status: approved ? 'approved' : 'needs-fixing',
        sourceImage: mapping.sourceImage,
        questionPrompt: seed.prompt,
        arabicAnswer: seed.answer,
        points: seed.points,
        verification,
      });
    }

    await writeFile(activeMappingsFile, JSON.stringify(fixtureMappings, null, 2));
    await writeFile(activeOutputFile, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ mock: true, fixtureRoot, results }, null, 2));
  } finally {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
}

async function main() {
  await runVerification({
    repoRootPath: repoRoot,
    reviewDirPath: reviewDir,
    mappingsFilePath: mappingsPath,
    outputFilePath: outputPath,
    seedsFilePath: seedsPath,
    dryRunMode: dryRun,
    mockMode: mock,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
