const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDirs = [
  'documents', 'events', 'exits', 'expense-claims', 'feedback-360',
  'interviews', 'jobs', 'learning-paths', 'notices', 'offers', 'okrs'
];

const basePath = path.join(__dirname, 'src', 'app', 'dashboard', 'hrm', 'hr');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = targetDirs.flatMap(dir => walk(path.join(basePath, dir)));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Remove `function fmtDate(...) { ... }` or `const fmtDate = ...`
  // Actually, let's just match `function fmtDate(value: unknown): string { ... }`
  const fmtDateRegex = /function fmtDate\([^\)]*\)[^\{]*\{[^}]*\}/g;
  if (fmtDateRegex.test(content)) {
    content = content.replace(fmtDateRegex, '');
    changed = true;
  }
  
  // Also remove `function fmtDateTime(v?: string): string { ... }`
  const fmtDateTimeRegex = /function fmtDateTime\([^\)]*\)[^\{]*\{[^\}]*\}/g;
  if (fmtDateTimeRegex.test(content)) {
    content = content.replace(fmtDateTimeRegex, '');
    // Replace calls to fmtDateTime with fmtDate
    content = content.replace(/fmtDateTime\(/g, 'fmtDate(');
    changed = true;
  }

  if (changed) {
    if (!content.includes("import { fmtDate }")) {
      // add import at top
      content = `import { fmtDate } from '@/lib/utils';\n` + content;
    }
    fs.writeFileSync(file, content);
    console.log(`Updated dates in ${file}`);
  }

  // Force dynamic
  if (file.endsWith('/page.tsx')) {
    let pageContent = fs.readFileSync(file, 'utf8');
    if (!pageContent.includes("export const dynamic = 'force-dynamic'") && !pageContent.includes("'use client'")) {
       pageContent = `export const dynamic = 'force-dynamic';\n` + pageContent;
       fs.writeFileSync(file, pageContent);
       console.log(`Added force-dynamic to ${file}`);
    }
  }
}
