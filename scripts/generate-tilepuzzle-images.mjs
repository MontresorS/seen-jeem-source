/**
 * generate-tilepuzzle-images.mjs
 *
 * Generates 50 AI-raster images for the Tile Puzzle game mode via Pollinations.ai.
 *
 * Usage:
 *   node scripts/generate-tilepuzzle-images.mjs [--overwrite]
 *
 * Requirements:
 *   - Internet access to image.pollinations.ai (blocked in CI sandbox — run locally)
 *   - Node.js 18+ with native fetch
 *
 * Output:
 *   client/public/images/tilepuzzle/tilepuzzle-01.png … tilepuzzle-50.png
 *   artifacts/tilepuzzle-review/index.html  (static review page)
 *
 * Per the spec: if Pollinations fails for any image, this script prints the exact
 * error and exits non-zero WITHOUT committing any partial output for that image.
 */

import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outputDir = resolve(repoRoot, 'client/public/images/tilepuzzle');
const reviewDir = resolve(repoRoot, 'artifacts/tilepuzzle-review');
const overwrite = process.argv.includes('--overwrite');
const GENERATION_DATE = new Date().toISOString().slice(0, 10);
const ENDPOINT = 'https://image.pollinations.ai/prompt';
const MODEL = 'flux'; // Pollinations default high-quality model

/** Build a safe Pollinations prompt for each round */
const ROUNDS = [
  // ── 200-point tier (17 rounds) ──────────────────────────────────────────────
  {
    id: 'tilepuzzle-01', points: 200, arabicAnswer: 'أسد',
    prompt: 'Majestic lion face with full golden mane, amber eyes, centered on warm golden savanna background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-02', points: 200, arabicAnswer: 'أندرويد',
    prompt: 'Friendly green android robot with rounded head and antenna standing centered, premium playful quiz-game illustration, vibrant rich background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-03', points: 200, arabicAnswer: 'أبل',
    prompt: 'Single perfectly ripe red apple with green leaf and stem, centered on rich colorful background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-04', points: 200, arabicAnswer: 'بي إم دبليو',
    prompt: 'Sleek shiny blue German luxury sports sedan car side view, premium playful quiz-game illustration, centered subject, rich background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-05', points: 200, arabicAnswer: 'برجر كينج',
    prompt: 'Tall juicy flame-grilled burger with sesame bun lettuce tomato cheese, centered, premium playful quiz-game illustration, vibrant background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-06', points: 200, arabicAnswer: 'كوكاكولا',
    prompt: 'Classic tall red glass soda bottle with fizzy cola bubbles inside, centered, premium playful quiz-game illustration, rich background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-07', points: 200, arabicAnswer: 'فيسبوك',
    prompt: 'Deep blue social media screen showing friends profile pictures connected by lines, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-08', points: 200, arabicAnswer: 'فيراري',
    prompt: 'Glossy red Italian sports car in dynamic racing pose, centered, premium playful quiz-game illustration, vibrant background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-09', points: 200, arabicAnswer: 'جوجل',
    prompt: 'Colorful search bar with magnifying glass in primary colors red blue yellow green, centered, premium playful quiz-game illustration, clean bright background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-10', points: 200, arabicAnswer: 'هواوي',
    prompt: 'Modern sleek smartphone with a round petal-lens camera array on its back, centered, premium playful quiz-game illustration, rich background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-11', points: 200, arabicAnswer: 'إنستجرام',
    prompt: 'Retro camera with colorful rainbow gradient finish centered on colorful background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-12', points: 200, arabicAnswer: 'كنتاكي',
    prompt: 'Crispy golden fried chicken pieces in red striped bucket, centered, premium playful quiz-game illustration, vibrant background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-13', points: 200, arabicAnswer: 'زهرة عباد الشمس',
    prompt: 'Large vibrant sunflower with bright yellow petals and detailed brown seed center, centered on clear blue sky background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-14', points: 200, arabicAnswer: 'بطاطس مقلية',
    prompt: 'Golden crispy french fries sticking out of a plain red paper cup, centered on warm background, premium playful quiz-game illustration, no text no letters no logos no watermarks no brand marks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-15', points: 200, arabicAnswer: 'نتفليكس',
    prompt: 'Red cinema screen with dramatic red curtains and film reel streaming setup, centered, premium playful quiz-game illustration, dark background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-16', points: 200, arabicAnswer: 'كرة سلة',
    prompt: 'Classic orange basketball with black seam curves, centered on hardwood court background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-17', points: 200, arabicAnswer: 'بلايستيشن',
    prompt: 'Black gaming controller with four colored symbol buttons triangle circle cross square, centered, premium playful quiz-game illustration, blue background, no text no letters no logos no watermarks, square 1024x1024',
  },

  // ── 400-point tier (17 rounds) ──────────────────────────────────────────────
  {
    id: 'tilepuzzle-18', points: 400, arabicAnswer: 'ريد بول',
    prompt: 'Silver aluminum energy drink can with two charging bulls facing each other, centered, premium playful quiz-game illustration, vivid background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-19', points: 400, arabicAnswer: 'سامسونج',
    prompt: 'Ultra-thin curved edge glass smartphone with vibrant display, side view, centered, premium playful quiz-game illustration, rich background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-20', points: 400, arabicAnswer: 'شل',
    prompt: 'Yellow and red scallop seashell on white background at a petrol station, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-21', points: 400, arabicAnswer: 'سماعات رأس',
    prompt: 'Stylish over-ear headphones in vibrant green color with curved headband, centered on dark background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-22', points: 400, arabicAnswer: 'دلفين',
    prompt: 'Playful bottlenose dolphin leaping over ocean waves with water splashing, centered on vivid blue ocean background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-23', points: 400, arabicAnswer: 'تليجرام',
    prompt: 'Blue paper airplane flying fast sending message through air, centered, premium playful quiz-game illustration, light blue background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-24', points: 400, arabicAnswer: 'تيك توك',
    prompt: 'Silhouette of person dancing with musical notes and phone showing vertical video, centered, premium playful quiz-game illustration, black background with neon accents, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-25', points: 400, arabicAnswer: 'جيب صحراوي',
    prompt: 'Rugged off-road desert jeep SUV driving through sand dunes, centered, premium playful quiz-game illustration, warm sandy background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-26', points: 400, arabicAnswer: 'فيزا',
    prompt: 'Gold credit card with chip and contactless payment wave symbol on clean background, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-27', points: 400, arabicAnswer: 'فودافون',
    prompt: 'Red speech bubble with mobile signal wave bars coming from phone, centered, premium playful quiz-game illustration, red background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-28', points: 400, arabicAnswer: 'واتساب',
    prompt: 'Green speech bubble with phone handset inside on white background, centered, premium playful quiz-game illustration, green background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-29', points: 400, arabicAnswer: 'عصفور',
    prompt: 'Cheerful blue songbird perched on branch with colorful feathers, centered on sky background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-30', points: 400, arabicAnswer: 'يوتيوب',
    prompt: 'Red rounded rectangle with white play triangle button on a cinema screen, centered, premium playful quiz-game illustration, red background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-31', points: 400, arabicAnswer: 'أناناس',
    prompt: 'Ripe golden pineapple with spiky green crown leaves, centered on bright background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-32', points: 400, arabicAnswer: 'برتقالة',
    prompt: 'Bright vibrant orange citrus fruit with leaves and blossom, centered, premium playful quiz-game illustration, warm colorful background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-33', points: 400, arabicAnswer: 'كرة تنس',
    prompt: 'Fuzzy yellow-green tennis ball with white curved seam, centered on clay court background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-34', points: 400, arabicAnswer: 'بنطلون جينز',
    prompt: 'Classic blue denim jeans trousers folded neatly, centered on wooden surface, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },

  // ── 600-point tier (16 rounds) ──────────────────────────────────────────────
  {
    id: 'tilepuzzle-35', points: 600, arabicAnswer: 'ورقة شجر',
    prompt: 'Single bright green maple leaf with detailed veins and stem, centered on white background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-36', points: 600, arabicAnswer: 'قرص عسل',
    prompt: 'Golden hexagonal honeycomb section dripping with amber honey and a single bee, centered, premium playful quiz-game illustration, warm background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-37', points: 600, arabicAnswer: 'حلزونة',
    prompt: 'Cute garden snail with colorful spiral shell slowly moving on green leaf, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-38', points: 600, arabicAnswer: 'كيوي',
    prompt: 'Halved kiwi fruit showing bright green flesh with small black seeds around white core, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-39', points: 600, arabicAnswer: 'سوستة',
    prompt: 'Metal zipper fastener half open on blue denim fabric showing teeth, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-40', points: 600, arabicAnswer: 'فرشاة أسنان',
    prompt: 'Colorful toothbrush with mint green toothpaste squeezed on bristles, centered on clean background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-41', points: 600, arabicAnswer: 'لمبة',
    prompt: 'Glowing warm yellow incandescent lightbulb with visible coil filament, centered on dark background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-42', points: 600, arabicAnswer: 'كيبورد',
    prompt: 'Computer keyboard with illuminated colorful RGB keys viewed from above, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-43', points: 600, arabicAnswer: 'مشط',
    prompt: 'Colorful plastic hair comb with fine teeth, centered on clean background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-44', points: 600, arabicAnswer: 'إسفنجة',
    prompt: 'Yellow rectangular kitchen sponge with textured surface and pores, centered on clean background, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-45', points: 600, arabicAnswer: 'مكرونة',
    prompt: 'Colorful Italian pasta shapes including spaghetti and fusilli with tomato sauce, centered in bowl, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-46', points: 600, arabicAnswer: 'بطيخة',
    prompt: 'Halved watermelon showing bright red flesh green rind and black seeds, centered, premium playful quiz-game illustration, sunny background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-47', points: 600, arabicAnswer: 'سلحفاة',
    prompt: 'Green sea turtle swimming gracefully underwater with patterned shell, centered, premium playful quiz-game illustration, ocean blue background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-48', points: 600, arabicAnswer: 'جيتار',
    prompt: 'Classic acoustic wooden guitar with six strings and sound hole, centered, premium playful quiz-game illustration, warm stage background, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-49', points: 600, arabicAnswer: 'ساعة حائط',
    prompt: 'Round wall clock with black hour and minute hands on clean white face with numbers, centered, premium playful quiz-game illustration, no text no letters no logos no watermarks, square 1024x1024',
  },
  {
    id: 'tilepuzzle-50', points: 600, arabicAnswer: 'فنجان قهوة',
    prompt: 'White ceramic coffee cup and saucer with steam rising and latte art, centered, premium playful quiz-game illustration, warm cafe background, no text no letters no logos no watermarks, square 1024x1024',
  },
];

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(prompt, outputPath, roundIndex) {
  // Deterministic seed based on round index so regeneration is reproducible
  const seed = 1000000 + roundIndex * 7919;
  const url = `${ENDPOINT}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=${MODEL}&seed=${seed}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for prompt: "${prompt.slice(0, 80)}…"`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Expected image content-type, got "${contentType}" for prompt: "${prompt.slice(0, 80)}…"`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error(`Suspiciously small image (${buffer.length} bytes) for prompt: "${prompt.slice(0, 80)}…"`);
  }
  await writeFile(outputPath, buffer);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildReviewHtml(results) {
  const rows = results.map((r) => `
    <tr class="${r.success ? '' : 'failed'}">
      <td>${escapeHtml(r.id)}</td>
      <td dir="rtl">${escapeHtml(r.arabicAnswer)}</td>
      <td>${r.points}</td>
      <td>${r.success ? `<img src="../../${escapeHtml(r.localPath)}" alt="${escapeHtml(r.arabicAnswer)}" loading="lazy">` : `<span class="error">${escapeHtml(r.error ?? 'unknown error')}</span>`}</td>
      <td class="prompt">${escapeHtml(r.prompt)}</td>
      <td>${escapeHtml(r.localPath)}</td>
      <td>${escapeHtml(ENDPOINT)} / model=${escapeHtml(MODEL)}</td>
      <td>${escapeHtml(GENERATION_DATE)}</td>
    </tr>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Tilepuzzle Image Review — سين وجيم</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 1rem; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
  th { background: #f0f0f0; }
  img { width: 80px; height: 80px; object-fit: cover; display: block; }
  .prompt { max-width: 320px; word-break: break-word; }
  .failed { background: #ffe0e0; }
  .error { color: red; font-weight: bold; }
  .note { background: #fff3cd; border: 1px solid #e0a800; padding: .5rem 1rem; margin-bottom: 1rem; border-radius: 4px; }
</style>
</head>
<body>
<h1>Tilepuzzle Image Review — سين وجيم</h1>
<p class="note">⚠️ This file is a review artifact only. It is NOT loaded by the game.</p>
<p>Generated: ${GENERATION_DATE} | Endpoint: ${escapeHtml(ENDPOINT)} | Model: ${escapeHtml(MODEL)}</p>
<table>
  <thead>
    <tr>
      <th>ID</th><th>Arabic Answer</th><th>Points</th><th>Preview</th>
      <th>Prompt</th><th>Local Path</th><th>Endpoint/Model</th><th>Date</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
</body>
</html>`;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  const results = [];
  let failures = 0;

  for (const [idx, round] of ROUNDS.entries()) {
    const filename = `${round.id}.png`;
    const outputPath = join(outputDir, filename);
    const localPath = `client/public/images/tilepuzzle/${filename}`;

    if (!overwrite && await fileExists(outputPath)) {
      console.log(`  skip  ${round.id} (already exists; use --overwrite to regenerate)`);
      results.push({ ...round, success: true, localPath });
      continue;
    }

    process.stdout.write(`  gen   ${round.id} (${round.arabicAnswer}) … `);
    try {
      await downloadImage(round.prompt, outputPath, idx);
      console.log('OK');
      results.push({ ...round, success: true, localPath });
    } catch (err) {
      console.error(`FAILED\n        ERROR: ${err.message}`);
      results.push({ ...round, success: false, localPath, error: err.message });
      failures++;
    }
  }

  // Write review page regardless of failures
  const html = await buildReviewHtml(results);
  await writeFile(join(reviewDir, 'index.html'), html, 'utf8');
  console.log(`\nReview page written → artifacts/tilepuzzle-review/index.html`);

  if (failures > 0) {
    console.error(`\n✗ ${failures} image(s) failed to generate. Affected assets are NOT committed.`);
    console.error('  Fix network access to image.pollinations.ai and re-run: node scripts/generate-tilepuzzle-images.mjs --overwrite');
    process.exit(1);
  }

  console.log(`\n✓ All ${ROUNDS.length} tilepuzzle images generated successfully.`);
  console.log('  Next step: commit client/public/images/tilepuzzle/*.png and artifacts/tilepuzzle-review/index.html');
}

main();
