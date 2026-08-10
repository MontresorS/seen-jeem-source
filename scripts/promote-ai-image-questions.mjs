import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const repoRoot = process.cwd();
const questionsFile = resolve(repoRoot, 'client/src/data/questions.ts');
const seedsPath = resolve(repoRoot, 'scripts/ai-image-question-seeds.json');
const verifyResultsPath = resolve(repoRoot, 'artifacts/image-review/ai-image-verify.json');
const publicImagesDir = resolve(repoRoot, 'client/public/images');
const mappingsPath = resolve(repoRoot, 'artifacts/image-review/ai-image-mappings.json');

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

async function main() {
  const seedsRaw = await readFile(seedsPath, 'utf8');
  const seeds = JSON.parse(seedsRaw);
  const verifyRaw = await readFile(verifyResultsPath, 'utf8').catch(() => '[]');
  const verifyResults = JSON.parse(verifyRaw);
  const mappingsRaw = await readFile(mappingsPath, 'utf8').catch(() => '[]');
  const mappings = JSON.parse(mappingsRaw);
  const approved = verifyResults.filter((entry) => entry.approved);
  if (approved.length === 0) {
    throw new Error('No approved mappings available to promote.');
  }

  const questionsSource = await readFile(questionsFile, 'utf8');
  const promotedSeeds = seeds.filter((seed) => approved.some((entry) => entry.questionId === seed.questionId));
  const zoomEntries = promotedSeeds.filter((seed) => seed.mode === 'zoom').map((seed) => `      { id: "${seed.questionId}", points: ${seed.points}, q: "${seed.prompt}", a: "${seed.answer}" },`).join('\n');
  const wadda7Entries = promotedSeeds.filter((seed) => seed.mode === 'wadda7').map((seed) => `      { id: "${seed.questionId}", points: ${seed.points}, q: "${seed.prompt}", a: "${seed.answer}" },`).join('\n');

  const updatedQuestionsSource = questionsSource
    .replace(/(key: "zoom"[\s\S]*?questions: \[)([\s\S]*?)(\n\s*\],)/, (match, prefix, existing, suffix) => {
      const insertion = existing.trimEnd();
      const body = insertion ? `${insertion}\n${zoomEntries}` : zoomEntries;
      return `${prefix}${body}${suffix}`;
    })
    .replace(/(key: "wadda7"[\s\S]*?questions: \[)([\s\S]*?)(\n\s*\],)/, (match, prefix, existing, suffix) => {
      const insertion = existing.trimEnd();
      const body = insertion ? `${insertion}\n${wadda7Entries}` : wadda7Entries;
      return `${prefix}${body}${suffix}`;
    });
  await writeFile(questionsFile, updatedQuestionsSource);

  for (const seed of promotedSeeds) {
    const mapping = mappings.find((entry) => entry.questionId === seed.questionId);
    if (!mapping) continue;
    const sourcePath = resolve(repoRoot, mapping.sourceImage);
    const targetPath = resolve(publicImagesDir, seed.mode, `${seed.questionId}.jpg`);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  execFileSync('npm', ['run', 'validate:image-questions'], { stdio: 'inherit' });
  console.log('\n--- git diff preview ---');
  execFileSync('git', ['diff', '--', 'client/src/data/questions.ts', 'client/public/images'], { stdio: 'inherit' });
  console.log(JSON.stringify({ promoted: approved.length, status: 'ready-for-review' }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
