const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/settings/team/team-table.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('fmtQty')) {
  code = code.replace(
    'import { fmtDate, formatUTC } from "@/lib/utils";',
    'import { fmtDate, formatUTC, fmtQty } from "@/lib/utils";'
  );
}

code = code.replace(
  /r\.apiKeyUsage\.toLocaleString\(\)/g,
  'fmtQty(r.apiKeyUsage)'
);

fs.writeFileSync(file, code);
