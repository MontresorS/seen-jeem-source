import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
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
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    throw new Error('Usage: npm run update:image-mapping -- <pending-review|approved|needs-fixing> <questionId> <sourceImagePath>');
  }

  const [statusArg, questionId, sourceImagePath] = args;
  const allowedStatuses = new Set(['pending-review', 'approved', 'needs-fixing']);
  if (!questionId || questionId.trim() === '') {
    throw new Error('Question ID is required.');
  }
  if (!allowedStatuses.has(statusArg)) {
    throw new Error(`Invalid status: ${statusArg}. Expected one of: ${Array.from(allowedStatuses).join(', ')}`);
  }

  const sourceImageAbsolutePath = resolve(repoRoot, sourceImagePath);
  if (!(await fileExists(sourceImageAbsolutePath))) {
    throw new Error(`Source image path does not exist: ${sourceImagePath}`);
  }

  await mkdir(reviewDir, { recursive: true });
  const existingRaw = await readFile(mappingsPath, 'utf8').catch(() => '[]');
  const existing = JSON.parse(existingRaw);
  const questionsSource = await readFile(questionsFile, 'utf8');
  const metadata = parseQuestionMetadata(questionsSource);
  const question = metadata.find((item) => item.questionId === questionId);
  if (!question) {
    throw new Error(`Question ID not found in zoom or wadda7 categories: ${questionId}`);
  }
  if (!['zoom', 'wadda7'].includes(question.mode)) {
    throw new Error(`Question ${questionId} is not a zoom or wadda7 question.`);
  }
  if (!question.questionPrompt || !question.arabicAnswer || question.points == null) {
    throw new Error(`Question record is missing required metadata for ${questionId}.`);
  }

  const entry = {
    questionId,
    mode: question.mode,
    sourceImage: sourceImagePath,
    questionPrompt: question.questionPrompt,
    arabicAnswer: question.arabicAnswer,
    points: question.points,
    status: statusArg,
  };
  const index = existing.findIndex((item) => item.questionId === questionId);
  if (index >= 0) existing[index] = entry; else existing.push(entry);
  await writeFile(mappingsPath, JSON.stringify(existing, null, 2));
  console.log(JSON.stringify({ updated: entry }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
