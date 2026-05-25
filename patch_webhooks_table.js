const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/webhooks/webhooks-table.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { fmtDate }')) {
  code = code.replace(
    'import {',
    'import { fmtDate } from "@/lib/utils";\nimport {'
  );
}

code = code.replace(
  /new Date\(row\.updatedAt\)\.toLocaleDateString\(\)/g,
  'fmtDate(row.updatedAt)'
);

fs.writeFileSync(file, code);
