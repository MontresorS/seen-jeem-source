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
function validateTrueFalse() {
  const block = extractCategory('truefalse');
  if (!block) { console.log('No truefalse category found'); return 1; }
  const objRe = /\{([\s\S]*?)\}/g;
  let m; let qs = [];
  while ((m = objRe.exec(block))) {
    const t = m[1];
    const id = (t.match(/id:\s*"([^"]+)"/) || [])[1];
    const points = parseInt((t.match(/points:\s*(\d+)/) || [])[1] || '0', 10);
    const choicesMatch = t.match(/choices:\s*\[((?:.|\n)*?)\]/);
    const correctMatch = t.match(/correctChoices:\s*\[((?:.|\n)*?)\]/);
    const choices = choicesMatch ? choicesMatch[1].split(',').map(s=>s.replace(/['"\s]/g,'')).filter(Boolean) : [];
    const correct = correctMatch ? correctMatch[1].split(',').map(s=>s.replace(/['"\s]/g,'')).filter(Boolean) : [];
    qs.push({ id, points, choices, correct });
  }
  let errors = 0;
  if (qs.length !== 50) { console.error('TRUEFALSE count != 50:', qs.length); errors++; }
  const counts = {200:0,400:0,600:0};
  for (const q of qs) {
    if (![200,400,600].includes(q.points)) { console.error('TRUEFALSE invalid points:', q.id, q.points); errors++; }
    counts[q.points] = (counts[q.points] || 0) + 1;
    if (q.choices.length !== 2 || q.choices[0] !== 'صح' || q.choices[1] !== 'فخ') { console.error('TRUEFALSE choices invalid for', q.id, q.choices); errors++; }
    if (q.correct.length !== 1) { console.error('TRUEFALSE must have exactly one correctChoice for', q.id, q.correct); errors++; }
  }
  if (counts[200] !== 17 || counts[400] !== 17 || counts[600] !== 16) { console.error('TRUEFALSE distribution wrong:', counts); errors++; }
  return errors;
}


function validateOrdering() {
  const block = extractCategory('ordering');
  if (!block) { console.log('No ordering category found'); return 1; }
  const objRe = /\{([\s\S]*?)\}/g;
  let m; let qs = [];
  while ((m = objRe.exec(block))) {
    const t = m[1];
    const id = (t.match(/id:\s*"([^"]+)"/) || [])[1];
    const points = parseInt((t.match(/points:\s*(\d+)/) || [])[1] || '0', 10);
    const orderItemsMatch = t.match(/orderItems:\s*\[([\s\S]*?)\]/);
    const correctOrderMatch = t.match(/correctOrder:\s*\[([\s\S]*?)\]/);
    const orderItems = orderItemsMatch
      ? orderItemsMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : [];
    const correctOrder = correctOrderMatch
      ? correctOrderMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : [];
    qs.push({ id, points, orderItems, correctOrder });
  }
  let errors = 0;
  if (qs.length !== 30) { console.error('ORDERING count != 30:', qs.length); errors++; }
  for (const q of qs) {
    if (![200,400,600].includes(q.points)) { console.error('ORDERING invalid points:', q.id, q.points); errors++; }
    if (q.orderItems.length === 0) { console.error('ORDERING missing orderItems:', q.id); errors++; }
    if (q.correctOrder.length === 0) { console.error('ORDERING missing correctOrder:', q.id); errors++; }
    if (q.orderItems.length !== q.correctOrder.length) { 
      console.error('ORDERING orderItems length != correctOrder length:', q.id, q.orderItems.length, q.correctOrder.length); 
      errors++; 
    }
    const orderSet = new Set(q.orderItems);
    const correctSet = new Set(q.correctOrder);
    if (orderSet.size !== q.orderItems.length) { console.error('ORDERING has duplicate orderItems:', q.id); errors++; }
    if (correctSet.size !== q.correctOrder.length) { console.error('ORDERING has duplicate correctOrder:', q.id); errors++; }
    const orderStr = JSON.stringify([...q.orderItems].sort());
    const correctStr = JSON.stringify([...q.correctOrder].sort());
    if (orderStr !== correctStr) { console.error('ORDERING orderItems and correctOrder have different items:', q.id); errors++; }
  }
  return errors;
}


function validateSilentFilms() {
  const block = extractCategory('silentfilms');
  if (!block) { console.log('No silentfilms category found'); return 0; }
  const qs = extractQuestions(block);
  let errors = 0;
  if (qs.length !== 50) { console.error('SILENTFILMS: expected 50 questions, got', qs.length); errors++; }
  const dist = { 200: 0, 400: 0, 600: 0 };
  const ids = new Set();
  for (const q of qs) {
    if (!q.a || q.a.trim() === '') { console.error('SILENTFILMS empty answer:', q.id); errors++; }
    if (!q.id || !q.id.startsWith('silentfilms-')) { console.error('SILENTFILMS invalid ID:', q.id); errors++; }
    if (ids.has(q.id)) { console.error('SILENTFILMS duplicate ID:', q.id); errors++; }
    ids.add(q.id);
    if (dist[q.points] !== undefined) dist[q.points]++;
  }
  if (dist[200] !== 17) { console.error('SILENTFILMS 200-point: expected 17, got', dist[200]); errors++; }
  if (dist[400] !== 17) { console.error('SILENTFILMS 400-point: expected 17, got', dist[400]); errors++; }
  if (dist[600] !== 16) { console.error('SILENTFILMS 600-point: expected 16, got', dist[600]); errors++; }
  return errors;
}

function validateDrawGuess() {
  const block = extractCategory('drawguess');
  if (!block) { console.log('No drawguess category found'); return 0; }
  const qs = extractQuestions(block);
  let errors = 0;
  if (qs.length !== 50) { console.error('DRAWGUESS: expected 50 questions, got', qs.length); errors++; }
  const dist = { 200: 0, 400: 0, 600: 0 };
  const ids = new Set();
  for (const q of qs) {
    if (!q.a || q.a.trim() === '') { console.error('DRAWGUESS empty prompt:', q.id); errors++; }
    if (!q.id || !q.id.startsWith('drawguess-')) { console.error('DRAWGUESS invalid ID:', q.id); errors++; }
    if (ids.has(q.id)) { console.error('DRAWGUESS duplicate ID:', q.id); errors++; }
    ids.add(q.id);
    if (dist[q.points] !== undefined) dist[q.points]++;
  }
  if (dist[200] !== 17) { console.error('DRAWGUESS 200-point: expected 17, got', dist[200]); errors++; }
  if (dist[400] !== 17) { console.error('DRAWGUESS 400-point: expected 17, got', dist[400]); errors++; }
  if (dist[600] !== 16) { console.error('DRAWGUESS 600-point: expected 16, got', dist[600]); errors++; }
  return errors;
}

function run() {
  console.log('Validating reversed and moving categories...');
  let errs = 0;
  errs += validateTrueFalse();
  errs += validateReversed();
  errs += validateMoving();
  errs += validateOrdering();
  errs += validateSilentFilms();
  errs += validateDrawGuess();
  if (errs === 0) console.log('Validation passed');
  else console.error('Validation found', errs, 'issues');
  process.exit(errs>0?1:0);
}

if (require.main === module) run();
module.exports = { normalizeArabic, letterCount };
