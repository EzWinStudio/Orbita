const fs = require('fs');
const path = require('path');

const enSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'en.ts'), 'utf8');
const enKeys = [...enSource.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)].map((m) => m[1]);

const files = ['shell.ts', 'business.ts', 'work.ts', 'mail.ts', 'modals.ts', 'youtube.ts', 'studio.ts', 'operations.ts', 'web.ts'];
const rows = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'dicts', file), 'utf8');
  for (const line of source.split('\n')) {
    if (!line.trim().startsWith('["')) continue;
    const literals = [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    if (literals.length !== 9) {
      console.log(`ROW SHAPE ${file}: ${literals.length} literals -> ${line.slice(0, 90)}`);
      continue;
    }
    rows.push({ file, key: literals[0], values: literals.slice(1) });
  }
}

const keySet = new Set(enKeys);
const seen = new Map();
const duplicates = [];
const missing = [];
for (const row of rows) {
  if (seen.has(row.key)) duplicates.push(row.key);
  seen.set(row.key, row);
  if (!keySet.has(row.key)) missing.push(row.key);
}

const missingKeys = enKeys.filter((key) => !seen.has(key));
console.log(`en keys: ${enKeys.length}`);
console.log(`rows: ${rows.length}`);
console.log(`missing keys: ${missingKeys.length}`);
if (missingKeys.length) console.log(missingKeys.join('\n'));
console.log(`unknown keys: ${missing.length}`);
if (missing.length) console.log(missing.join('\n'));
console.log(`duplicates: ${duplicates.length}`);
if (duplicates.length) console.log(duplicates.join('\n'));

const placeholderProblems = [];
for (const row of rows) {
  const expected = [...row.key.matchAll(/\{[^}]+\}/g)].map((m) => m[0]).sort().join(' ');
  row.values.forEach((value, index) => {
    const actual = [...value.matchAll(/\{[^}]+\}/g)].map((m) => m[0]).sort().join(' ');
    if (actual !== expected) {
      placeholderProblems.push(`${row.key} [${index}]: expected "${expected}" got "${actual}"`);
    }
  });
}
console.log(`placeholder problems: ${placeholderProblems.length}`);
if (placeholderProblems.length) console.log(placeholderProblems.slice(0, 40).join('\n'));
