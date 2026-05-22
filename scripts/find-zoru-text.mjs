import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = './src';

function collect(dir) {
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const sub = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(sub));
    else if (entry.isFile() && (sub.endsWith('.tsx') || sub.endsWith('.ts'))) out.push(sub);
  }
  return out;
}

const files = collect(SRC_DIR);
const zoruWords = [
  'Button', 'Input', 'Textarea', 'Label', 'Skeleton', 'Switch', 'Checkbox',
  'Avatar', 'Separator', 'Card', 'Alert', 'Badge', 'Table', 'Dialog', 'Sheet',
  'Popover', 'DropdownMenu', 'Select', 'RadioGroup', 'Tooltip', 'ScrollArea',
  'Accordion', 'Progress', 'DatePicker', 'Breadcrumb', 'PageHeader'
];

const zoruRegex = new RegExp(`\\bZoru(${zoruWords.join('|')})\\b`, 'g');

let count = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignore imports
    if (line.trim().startsWith('import ')) continue;
    // Ignore exports
    if (line.trim().startsWith('export ')) continue;
    
    // Find all matches in the line
    let m;
    while ((m = zoruRegex.exec(line)) !== null) {
      // Check surrounding context
      // Is it a JSX tag? `<ZoruSelect` or `</ZoruSelect>`
      const prefix = line.slice(Math.max(0, m.index - 2), m.index);
      if (prefix.includes('<') || prefix.includes('</')) {
        continue;
      }
      
      // Is it a component prop or object property like `ZoruSelect:` or `ZoruSelect={...}`?
      // Check character after word
      const suffix = line.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if (suffix.startsWith('.') || suffix.startsWith(':') || suffix.startsWith('=')) {
         // Wait, `ZoruSelect:` could be valid? No, usually not. But let's log it anyway.
      }
      
      console.log(`${file}:${i + 1}: ${line.trim()}`);
      count++;
    }
  }
}
console.log(`Found ${count} potential matches.`);
