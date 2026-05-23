const fs = require('fs');

const files = [
  'src/app/dashboard/crm/inventory/items/_components/item-detail-body.tsx',
  'src/app/dashboard/crm/inventory/items/_components/item-print-view.tsx',
  'src/app/dashboard/crm/inventory/items/_components/items-grid.tsx',
  'src/app/dashboard/crm/inventory/items/_components/items-kpi-strip.tsx',
  'src/app/dashboard/crm/inventory/items/_components/items-table.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/function fmtINR[\s\S]*?\} catch \{[\s\S]*?\}[\s\S]*?\}/, '');
  // check if fmtINR is already imported
  if (!content.includes('fmtINR')) continue;
  if (!content.includes("import { fmtINR }")) {
      content = content.replace(/(import .*;\n)/, "$1import { fmtINR } from '@/lib/utils';\n");
  }
  fs.writeFileSync(file, content);
}

let relatedRailFile = 'src/app/dashboard/crm/inventory/items/_components/item-related-rail.tsx';
let railContent = fs.readFileSync(relatedRailFile, 'utf8');
railContent = railContent.replace(/function fmtDate[\s\S]*?\} catch \{[\s\S]*?\}[\s\S]*?\}/, '');
if (!railContent.includes("import { fmtDate }")) {
    railContent = railContent.replace(/(import .*;\n)/, "$1import { fmtDate } from '@/lib/utils';\n");
}
fs.writeFileSync(relatedRailFile, railContent);
