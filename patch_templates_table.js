const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/templates/templates-table.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('formatUTC')) {
  code = code.replace(
    'import {',
    'import { formatUTC, fmtQty, fmtDate } from "@/lib/utils";\nimport {'
  );
}

code = code.replace(/\{row\.usageCount\.toLocaleString\(\)\}/g, '{fmtQty(row.usageCount)}');
code = code.replace(/new Date\(row\.updatedAt\)\.toLocaleDateString\(\)/g, 'fmtDate(row.updatedAt)');
code = code.replace(/\{new Date\(e\.at\)\.toLocaleString\(\)\}/g, '{formatUTC(e.at, true)}');

fs.writeFileSync(file, code);
