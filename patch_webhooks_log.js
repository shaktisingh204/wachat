const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/webhooks/log/client.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import { formatUTC } from "@/lib/utils";')) {
  code = code.replace(
    'import * as React from "react";',
    'import * as React from "react";\nimport { formatUTC } from "@/lib/utils";'
  );
}

code = code.replace(/new Date\(r\.createdAt\)\.toLocaleString\(\)/g, 'formatUTC(r.createdAt, true)');
code = code.replace(/new Date\(selectedRow\.createdAt\)\.toLocaleString\(\)/g, 'formatUTC(selectedRow.createdAt, true)');

code = code.replace(
  'export default function WebhookLogPage() {',
  'export default function WebhookLogClient() {'
);

fs.writeFileSync(file, code);
