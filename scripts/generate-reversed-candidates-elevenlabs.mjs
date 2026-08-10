import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

config();

const repoRoot = process.cwd();
const questionsFile = resolve(repoRoot, 'client/src/data/questions.ts');
const outputDir = resolve(repoRoot, 'client/public/reversed-audio-candidates-neural');
const manifestPath = resolve(outputDir, 'manifest.json');
const isFullRun = process.argv.includes('--full');

const LETTER_MAP = {
  'ا': 'ألف',
  'أ': 'ألف',
  'إ': 'ألف',
  'آ': 'ألف',
  'ب': 'باء',
  'ت': 'تاء',
  'ث': 'ثاء',
  'ج': 'جيم',
  'ح': 'حاء',
  'خ': 'خاء',
  'د': 'دال',
  'ذ': 'ذال',
  'ر': 'راء',
  'ز': 'زاي',
  'س': 'سين',
  'ش': 'شين',
  'ص': 'صاد',
  'ض': 'ضاد',
  'ط': 'طاء',
  'ظ': 'ظاء',
  'ع': 'عين',
  'غ': 'غين',
  'ف': 'فاء',
  'ق': 'قاف',
  'ك': 'كاف',
  'ل': 'لام',
  'م': 'ميم',
  'ن': 'نون',
  'ه': 'هاء',
  'و': 'واو',
  'ي': 'ياء',
  'ء': 'همزة',
  'ة': 'تاء مربوطة',
  'ى': 'ألف مقصورة',
  'ئ': 'ياء مهموزة',
  'ؤ': 'واو مهموزة',
};

function extractDisplayedReversedText(prompt) {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  const arrowIndex = cleaned.indexOf('←');
  if (arrowIndex === -1) return cleaned;
  return cleaned.slice(0, arrowIndex).trim();
}

function parseReversedQuestions(source) {
  const reversedStart = source.indexOf('key: "reversed"');
  if (reversedStart === -1) throw new Error('Could not find reversed category block');

  const questionsIndex = source.indexOf('questions:', reversedStart);
  if (questionsIndex === -1) throw new Error('Could not find reversed questions array');

  const openingBracket = source.indexOf('[', questionsIndex);
  if (openingBracket === -1) throw new Error('Could not find reversed questions opening bracket');

  const closingBracket = source.indexOf('],', openingBracket);
  if (closingBracket === -1) throw new Error('Could not find reversed questions closing bracket');

  const block = source.slice(openingBracket + 1, closingBracket);
  const items = [...block.matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*points:\s*(\d+)\s*,\s*q:\s*"([^"]+)"\s*,\s*a:\s*"([^"]+)"/g)];
  return items.map((m) => ({ id: m[1], points: Number(m[2]), displayedPhrase: extractDisplayedReversedText(m[3]), answer: m[4] }));
}

function normalizeArabicText(text) {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countArabicLetters(text) {
  const normalized = normalizeArabicText(text);
  return normalized.replace(/[^\u0600-\u06FF]/g, '').length;
}

function buildLetterNamePhrase(displayedText) {
  const normalized = normalizeArabicText(displayedText);
  const letters = normalized.split('').filter((ch) => ch !== ' ' && ch !== '،' && ch !== '؛' && ch !== ':' && ch !== '!' && ch !== '?');
  const names = letters.map((char) => LETTER_MAP[char] ?? char);
  return names.join('، ');
}

function validateQuestion(question) {
  const letterCount = countArabicLetters(question.displayedPhrase);
  const words = normalizeArabicText(question.displayedPhrase).split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (question.points === 400) {
    const passes = letterCount >= 6 && letterCount <= 7;
    return { passes, reason: passes ? null : `400-point question must have 6 or 7 Arabic letters; found ${letterCount}` };
  }

  if (question.points === 600) {
    if (wordCount === 1) {
      const passes = letterCount >= 10 && letterCount <= 13;
      return { passes, reason: passes ? null : `600-point one-word question must have 10-13 Arabic letters; found ${letterCount}` };
    }
    const passes = letterCount >= 6;
    return { passes, reason: passes ? null : `600-point multi-word question must have at least 6 Arabic letters; found ${letterCount}` };
  }

  return { passes: false, reason: 'Only 400- and 600-point reversed questions are processed' };
}

async function synthesizeWithElevenLabs(text, outputFile) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

  if (!apiKey || !voiceId) {
    throw new Error('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.9,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status}): ${detail}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputFile, buffer);
  return buffer.length;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const source = await readFile(questionsFile, 'utf8');
  const questions = parseReversedQuestions(source);

  const valid400 = questions.filter((q) => q.points === 400);
  const valid600 = questions.filter((q) => q.points === 600);
  const selectedQuestions = isFullRun
    ? questions
    : [valid400[0], valid600[0]].filter(Boolean);

  if (selectedQuestions.length === 0) {
    throw new Error('No valid questions matched the selection criteria');
  }

  const manifest = [];
  const results = [];

  for (const question of selectedQuestions) {
    const validation = validateQuestion(question);
    const phrase = buildLetterNamePhrase(question.displayedPhrase);
    const outputFile = join(outputDir, `${question.id}-letters.mp3`);
    const candidateMp3Path = `client/public/reversed-audio-candidates-neural/${question.id}-letters.mp3`;

    const entry = {
      questionId: question.id,
      points: question.points,
      displayedReversedText: question.displayedPhrase,
      normalAnswer: question.answer,
      passesDifficultyRule: validation.passes,
      generatedArabicLetterPhrase: phrase,
      candidateMp3Path,
      status: 'pending',
    };

    try {
      const size = await synthesizeWithElevenLabs(phrase, outputFile);
      entry.status = 'generated';
      entry.fileSizeBytes = size;
      results.push({
        questionId: question.id,
        points: question.points,
        candidateMp3Path,
        phrase,
        fileSizeBytes: size,
        status: 'generated',
        error: null,
      });
    } catch (error) {
      entry.status = 'failed';
      entry.error = error instanceof Error ? error.message : String(error);
      results.push({
        questionId: question.id,
        points: question.points,
        candidateMp3Path,
        phrase,
        fileSizeBytes: null,
        status: 'failed',
        error: entry.error,
      });
    }

    manifest.push(entry);
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({
    mode: isFullRun ? 'full' : 'dry-run-test',
    apiConfigured: Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim()),
    results,
    manifestPath: `client/public/reversed-audio-candidates-neural/manifest.json`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
