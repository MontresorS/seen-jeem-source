import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const reviewDir = resolve(repoRoot, 'artifacts/image-review');
const mappingsPath = resolve(reviewDir, 'mappings.json');
const questionsFile = resolve(repoRoot, 'client/src/data/questions.ts');
const statusArg = process.argv[2];
const questionId = process.argv[3];
const sourceImage = process.argv[4];

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

async function main() {
  await mkdir(reviewDir, { recursive: true });
  const existingRaw = await readFile(mappingsPath, 'utf8').catch(() => '[]');
  const existing = JSON.parse(existingRaw);
  const questionsSource = await readFile(questionsFile, 'utf8');
  const metadata = parseQuestionMetadata(questionsSource);
  const question = metadata.find((item) => item.questionId === questionId);
  if (!question) {
    throw new Error(`Unknown question ID: ${questionId}`);
  }

  const entry = {
    questionId,
    mode: question.mode,
    sourceImage,
    questionPrompt: question.questionPrompt,
    arabicAnswer: question.arabicAnswer,
    points: question.points,
    status: statusArg === 'approved' ? 'approved' : 'pending-review',
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
