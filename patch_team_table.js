const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/settings/team/team-table.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add import
if (!code.includes('import { fmtDate }')) {
  code = code.replace(
    'import { MoreHorizontal, Download, Play, ShieldAlert, Key, Server, StopCircle, RefreshCw, X, Search, CheckSquare } from "lucide-react";',
    'import { MoreHorizontal, Download, Play, ShieldAlert, Key, Server, StopCircle, RefreshCw, X, Search, CheckSquare } from "lucide-react";\nimport { fmtDate, formatUTC } from "@/lib/utils";'
  );
}

// Format relative time: return new Date(iso).toLocaleDateString();
code = code.replace(
  'return new Date(iso).toLocaleDateString();',
  'return fmtDate(iso);'
);

// Format event time: <span>{new Date(e.at).toLocaleString()}</span>
code = code.replace(
  /<span>\{new Date\(e\.at\)\.toLocaleString\(\)\}<\/span>/g,
  '<span>{formatUTC(e.at, true)}</span>'
);

fs.writeFileSync(file, code);
