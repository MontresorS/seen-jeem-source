import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const outputDir = resolve(repoRoot, 'client/public/reversed-audio-candidates-neural');
const manifestPath = resolve(outputDir, 'manifest.json');

async function main() {
  try {
    const manifestText = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestText);
    const files = (await readdir(outputDir)).filter((entry) => entry.endsWith('.mp3'));
    const verified = [];
    for (const entry of files) {
      const fullPath = resolve(outputDir, entry);
      const info = await stat(fullPath);
      verified.push({ file: entry, size: info.size });
    }
    console.log(JSON.stringify({ verifiedFiles: verified.length, manifestEntries: manifest.length, files: verified.slice(0, 10) }, null, 2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
