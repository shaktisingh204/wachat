const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/suppressions/suppressions-table.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { fmtDate, formatUTC, fmtQty, fmtINR } from "@/lib/utils";')) {
  code = code.replace(
    'import {',
    'import { fmtDate, formatUTC, fmtQty, fmtINR } from "@/lib/utils";\nimport {'
  );
}

// Replace dates
code = code.replace(/\{new Date\(r\.createdAt\)\.toLocaleString\([^)]*\)\}/g, '{formatUTC(r.createdAt, true)}');
code = code.replace(/\{new Date\(r\.expiresAt\)\.toLocaleString\([^)]*\)\}/g, '{formatUTC(r.expiresAt, true)}');
code = code.replace(/new Date\(r\.lastTouchedAt\)\.toLocaleString\([^)]*\)/g, 'formatUTC(r.lastTouchedAt, true)');
code = code.replace(/\{new Date\(e\.at\)\.toLocaleString\(\)\}/g, '{formatUTC(e.at, true)}');

// Replace numbers
code = code.replace(/coverage\.suppressed\.toLocaleString\(\)/g, 'fmtQty(coverage.suppressed)');
code = code.replace(/coverage\.workspaceContacts\.toLocaleString\(\)/g, 'fmtQty(coverage.workspaceContacts)');
code = code.replace(/total\.toLocaleString\(\)/g, 'fmtQty(total)');

fs.writeFileSync(file, code);
