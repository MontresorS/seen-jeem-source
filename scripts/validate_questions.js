const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'client', 'src', 'data', 'questions.ts');
const src = fs.readFileSync(file, 'utf8');

function extractCategory(key) {
  const re = new RegExp(`key:\s*"${key}"[\s\S]*?questions:\s*\[([\s\S]*?)\]`, 'm');
  const m = src.match(re);
  if (!m) return null;
  return m[1];
}

function extractQuestions(block) {
  const objs = [];
  const objRe = /\{([^}]+)\}/g;
  let match;
  while ((match = objRe.exec(block))) {
    const objText = match[1];
    const id = (objText.match(/id:\s*"([^"]+)"/) || [])[1];
    const points = parseInt((objText.match(/points:\s*(\d+)/) || [])[1] || '0', 10);
    const q = (objText.match(/q:\s*"([^"]+)"/) || [])[1];
    const a = (objText.match(/a:\s*"([^"]+)"/) || [])[1];
    objs.push({ id, points, q, a });
  }
  return objs;
}

function normalizeArabic(s) {
  if (!s) return '';
  // remove Arabic diacritics
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  // remove punctuation and non-Arabic letters/digits
  s = s.replace(/[^\u0600-\u06FF\s]/g, '');
  // normalize spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function letterCount(s) {
  const n = (s.match(/[\u0600-\u06FF]/g) || []).length;
  return n;
}

function validateReversed() {
  const block = extractCategory('reversed');
  if (!block) { console.log('No reversed category found'); return 1; }
  const qs = extractQuestions(block);
  let errors = 0;
  for (const q of qs) {
    if (q.points === 400) {
      const norm = normalizeArabic(q.a).replace(/\s/g, '');
      if (letterCount(norm) < 7) {
        console.error('REVERSED 400 too short:', q.id, q.a, 'letters=', letterCount(norm)); errors++;
      }
    }
    if (q.points === 600) {
      // must be exactly two words, both >=4 letters
      const norm = normalizeArabic(q.a);
      const parts = norm.split(' ');
      if (parts.length !== 2) {
        console.error('REVERSED 600 not two words:', q.id, q.a, 'parts=', parts);
        errors++;
      } else {
        const ok = parts.every(p => letterCount(p) >= 4);
        if (!ok) { console.error('REVERSED 600 word length fail:', q.id, q.a, 'parts=', parts.map(p=>`${p}(${letterCount(p)})`)); errors++; }
      }
      // q text must be exact char-reversal of a plus arrow suffix
      const reversed = q.a.split('').reverse().join('');
      if (!q.q.includes(reversed)) { console.error('REVERSED q not exact reverse:', q.id, 'q=', q.q, 'expected contains=', reversed); errors++; }
    }
  }
  return errors;
}

function validateMoving() {
  const block = extractCategory('moving');
  if (!block) { console.log('No moving category found'); return 1; }
  const qs = extractQuestions(block);
  let errors = 0;
  for (const q of qs) {
    if (q.points === 400) {
      const norm = normalizeArabic(q.a).replace(/\s/g, '');
      if (letterCount(norm) < 7) { console.error('MOVING 400 too short:', q.id, q.a, 'letters=', letterCount(norm)); errors++; }
    }
    if (q.points === 600) {
      const norm = normalizeArabic(q.a);
      const parts = norm.split(' ');
      if (parts.length !== 2) { console.error('MOVING 600 not two words:', q.id, q.a, 'parts=', parts); errors++; }
      else {
        const ok = parts.every(p => letterCount(p) >= 4);
        if (!ok) { console.error('MOVING 600 word length fail:', q.id, q.a, 'parts=', parts.map(p=>`${p}(${letterCount(p)})`)); errors++; }
      }
    }
  }
  return errors;
}

+function validateTrueFalse() {
+  const block = extractCategory('truefalse');
+  if (!block) { console.log('No truefalse category found'); return 1; }
+  const objRe = /\{([\s\S]*?)\}/g;
+  let m; let qs = [];
+  while ((m = objRe.exec(block))) {
+    const t = m[1];
+    const id = (t.match(/id:\s*"([^"]+)"/) || [])[1];
+    const points = parseInt((t.match(/points:\s*(\d+)/) || [])[1] || '0', 10);
+    const choicesMatch = t.match(/choices:\s*\[((?:.|\n)*?)\]/);
+    const correctMatch = t.match(/correctChoices:\s*\[((?:.|\n)*?)\]/);
+    const choices = choicesMatch ? choicesMatch[1].split(',').map(s=>s.replace(/['"\s]/g,'')).filter(Boolean) : [];
+    const correct = correctMatch ? correctMatch[1].split(',').map(s=>s.replace(/['"\s]/g,'')).filter(Boolean) : [];
+    qs.push({ id, points, choices, correct });
+  }
+  let errors = 0;
+  if (qs.length !== 50) { console.error('TRUEFALSE count != 50:', qs.length); errors++; }
+  const counts = {200:0,400:0,600:0};
+  for (const q of qs) {
+    if (![200,400,600].includes(q.points)) { console.error('TRUEFALSE invalid points:', q.id, q.points); errors++; }
+    counts[q.points] = (counts[q.points] || 0) + 1;
+    if (q.choices.length !== 2 || q.choices[0] !== 'صح' || q.choices[1] !== 'فخ') { console.error('TRUEFALSE choices invalid for', q.id, q.choices); errors++; }
+    if (q.correct.length !== 1) { console.error('TRUEFALSE must have exactly one correctChoice for', q.id, q.correct); errors++; }
+  }
+  if (counts[200] !== 17 || counts[400] !== 17 || counts[600] !== 16) { console.error('TRUEFALSE distribution wrong:', counts); errors++; }
+  return errors;
+}


function run() {
  console.log('Validating reversed and moving categories...');
  let errs = 0;
  errs += validateTrueFalse();
  errs += validateReversed();
  errs += validateMoving();
  if (errs === 0) console.log('Validation passed');
  else console.error('Validation found', errs, 'issues');
  process.exit(errs>0?1:0);
}

if (require.main === module) run();
module.exports = { normalizeArabic, letterCount };
