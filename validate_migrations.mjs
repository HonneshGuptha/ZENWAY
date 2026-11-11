import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve migrations directory whether executed from supabase/ or root
let migrationsDir = path.join(__dirname, 'migrations');
if (!fs.existsSync(migrationsDir)) {
  migrationsDir = path.join(__dirname, 'supabase', 'migrations');
}

console.log(`[ZENWAY] Scanning migration directory: ${migrationsDir}`);

if (!fs.existsSync(migrationsDir)) {
  console.error(`[ERROR] Migrations directory not found at ${migrationsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

console.log(`[ZENWAY] Found ${files.length} migration files in sequence:`);

let totalErrors = 0;

for (let idx = 0; idx < files.length; idx++) {
  const file = files[idx];
  const fullPath = path.join(migrationsDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');

  // 1. Check dollar quotes ($$) pairing
  const dollarMatches = content.match(/\$\$/g);
  if (dollarMatches && dollarMatches.length % 2 !== 0) {
    console.error(`  [FAIL] ${file}: Unmatched $$ plpgsql block tags (count: ${dollarMatches.length})`);
    totalErrors++;
  }

  // 2. Check parenthesis balancing ignoring SQL strings and comments
  let parenBalance = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDollarQuote = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingleQuote) {
      if (c === "'") {
        if (next === "'") {
          i++; // escaped quote
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }
    if (inDollarQuote) {
      if (c === '$' && next === '$') {
        inDollarQuote = false;
        i++;
      }
      continue;
    }

    if (c === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (c === "'") {
      inSingleQuote = true;
      continue;
    }
    if (c === '$' && next === '$') {
      inDollarQuote = true;
      i++;
      continue;
    }

    if (c === '(') parenBalance++;
    if (c === ')') parenBalance--;

    if (parenBalance < 0) {
      console.error(`  [FAIL] ${file}: Unbalanced closing parenthesis at character ${i}`);
      totalErrors++;
      break;
    }
  }

  if (parenBalance > 0) {
    console.error(`  [FAIL] ${file}: Unclosed opening parenthesis (+${parenBalance} unclosed)`);
    totalErrors++;
  }

  if (totalErrors === 0) {
    const lineCount = content.split('\n').length;
    console.log(`  [OK] ${String(idx + 1).padStart(2, '0')}. ${file} (${lineCount} lines, ${content.length} bytes)`);
  }
}

if (totalErrors === 0) {
  console.log(`\n[SUCCESS] All ${files.length} migrations passed static syntax & integrity validation.`);
} else {
  console.error(`\n[FAILED] Validation encountered ${totalErrors} syntax errors.`);
  process.exit(1);
}
