const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/settings/team/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'import { Users, ShieldCheck, MailWarning, Activity } from "lucide-react";',
  'import { Users, ShieldCheck, MailWarning, Activity } from "lucide-react";\nimport { fmtQty } from "@/lib/utils";'
);

code = code.replace(
  'value={totalApiUsage.toLocaleString()}',
  'value={fmtQty(totalApiUsage)}'
);

fs.writeFileSync(file, code);
