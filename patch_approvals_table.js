const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/templates/approvals/approvals-table.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('formatUTC')) {
  code = code.replace(
    'import {',
    'import { formatUTC } from "@/lib/utils";\nimport {'
  );
}

code = code.replace(
  /\? new Date\(row\.submittedAt\)\.toLocaleString\(\)/g,
  '? formatUTC(row.submittedAt, true)'
);
code = code.replace(
  /\{new Date\(d\.at\)\.toLocaleString\(\)\}/g,
  '{formatUTC(d.at, true)}'
);

fs.writeFileSync(file, code);
