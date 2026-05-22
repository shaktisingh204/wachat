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
  'Accordion', 'Progress', 'DatePicker', 'Breadcrumb', 'PageHeader', 'NotificationCard', 'ChartCard', 'KpiCard', 'StatCard', 'DataTable', 'Calendar', 'EmptyState', 'Tabs', 'TabsList', 'Tab'
];

let replacedFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let current = original;

  for (const word of zoruWords) {
    const regex = new RegExp(`(?<=[>\\s"'\`])Zoru${word}(?=[\\s.,!?"'<])`, 'g');
    current = current.replace(regex, word);
  }

  if (current !== original) {
    fs.writeFileSync(file, current, 'utf8');
    replacedFiles++;
    // count how many times things changed
    let count = 0;
    for (let i = 0; i < original.length; i++) {
        if (original[i] !== current[i]) {
            count++;
            break;
        }
    }
  }
}

console.log(`Fixed text in ${replacedFiles} files.`);
