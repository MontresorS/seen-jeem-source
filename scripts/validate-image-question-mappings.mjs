import { readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const reviewDir = resolve(repoRoot, 'artifacts/image-review');
const mappingsPath = resolve(reviewDir, 'mappings.json');
const questionsFile = resolve(repoRoot, 'client/src/data/questions.ts');

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

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const mappingsRaw = await readFile(mappingsPath, 'utf8').catch(() => '[]');
  const mappings = JSON.parse(mappingsRaw);
  const questionsSource = await readFile(questionsFile, 'utf8');
  const questions = parseQuestionMetadata(questionsSource);
  const questionById = new Map(questions.map((question) => [question.questionId, question]));
  const errors = [];

  for (const mapping of mappings) {
    const question = questionById.get(mapping.questionId);
    if (!mapping.questionId) {
      errors.push('Mapping is missing questionId.');
      continue;
    }
    if (!question) {
      errors.push(`Missing question ID: ${mapping.questionId}`);
      continue;
    }
    if (!mapping.sourceImage) {
      errors.push(`Missing source image for ${mapping.questionId}`);
      continue;
    }
    if (!['pending-review', 'approved', 'needs-fixing'].includes(mapping.status)) {
      errors.push(`Invalid status for ${mapping.questionId}: ${mapping.status}`);
    }
    if (mapping.mode !== question.mode) {
      errors.push(`Mode mismatch for ${mapping.questionId}: expected ${question.mode}, got ${mapping.mode}`);
    }
    if (mapping.questionPrompt !== question.questionPrompt) {
      errors.push(`Prompt mismatch for ${mapping.questionId}: expected ${question.questionPrompt}, got ${mapping.questionPrompt}`);
    }
    if (mapping.arabicAnswer !== question.arabicAnswer) {
      errors.push(`Arabic answer mismatch for ${mapping.questionId}: expected ${question.arabicAnswer}, got ${mapping.arabicAnswer}`);
    }
    if (Number(mapping.points) !== question.points) {
      errors.push(`Point tier mismatch for ${mapping.questionId}: expected ${question.points}, got ${mapping.points}`);
    }
    const sourcePath = resolve(repoRoot, mapping.sourceImage);
    if (!(await fileExists(sourcePath))) {
      errors.push(`Source image missing for ${mapping.questionId}: ${mapping.sourceImage}`);
      continue;
    }

    const requiredOutputs = question.mode === 'zoom' ? ['crop-1.jpg', 'crop-2.jpg', 'crop-3.jpg'] : ['stage-1.jpg', 'stage-2.jpg', 'stage-3.jpg'];
    const reviewEntryDir = resolve(repoRoot, 'artifacts/image-review/generated', `${mapping.sourceImage.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'source'}-${mapping.questionId}`);
    for (const outputName of requiredOutputs) {
      const outputPath = resolve(reviewEntryDir, outputName);
      if (!(await fileExists(outputPath))) {
        errors.push(`Missing generated output for ${mapping.questionId}: ${outputName}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  console.log(JSON.stringify({ approvedMappings: mappings.filter((item) => item.status === 'approved').length, status: 'ok' }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
