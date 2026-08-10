// Convert ordering questions from "item1 ➔ item2 ➔ ..." to orderItems/correctOrder format
const fs = require('fs');
const path = require('path');

// Read the data file
const dataPath = path.join(__dirname, '../client/src/data/questions.ts');
const content = fs.readFileSync(dataPath, 'utf-8');

// Find and parse ordering questions
let result = content;
let found = 0;

// Simple replacement function
function convertQuestion(line) {
  // Match lines like: { id: "ordering-1", points: 200, q: "...", a: "item1 ➔ item2 ➔ ..." }
  const match = line.match(/(\{\s*id:\s*"ordering-\d+",\s*points:\s*\d+,\s*q:\s*"[^"]*",\s*a:\s*)"([^"]+)"/);
  if (!match) return line;
  
  const prefix = match[1];
  const answer = match[2];
  
  // Check if answer contains ➔
  if (!answer.includes('➔')) {
    return line;
  }
  
  // Split by ➔ and trim
  const items = answer.split('➔').map(item => item.trim());
  
  if (items.length < 2) {
    return line;
  }
  
  // Generate the new format
  const orderItems = JSON.stringify(items);
  const correctOrder = JSON.stringify(items);
  
  // Replace in original line
  const newLine = line.replace(
    /(\{\s*id:\s*"ordering-\d+",\s*points:\s*\d+,\s*q:\s*"[^"]*",\s*a:\s*)"[^"]+"(\s*[},])/,
    `$1"${answer}", orderItems: ${orderItems}, correctOrder: ${correctOrder}$2`
  );
  
  return newLine;
}

// Process line by line
const lines = result.split('\n');
const converted = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('ordering-') && line.includes('➔')) {
    const newLine = convertQuestion(line);
    if (newLine !== line) {
      found++;
    }
    converted.push(newLine);
  } else {
    converted.push(line);
  }
}

console.log(`Found and converted ${found} ordering questions`);

// Write back
fs.writeFileSync(dataPath, converted.join('\n'));
console.log('Conversion complete');
