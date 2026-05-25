const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/settings/billing/billing-client.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add imports
code = code.replace(
  'import { cn } from "@/components/zoruui/lib/cn";',
  'import { cn } from "@/components/zoruui/lib/cn";\nimport { fmtDate, fmtINR } from "@/lib/utils";'
);

// Format date
code = code.replace(
  'accessorKey: "date",\n      header: "Date",',
  'accessorKey: "date",\n      header: "Date",\n      cell: ({ row }) => <span>{fmtDate(row.getValue("date"))}</span>,'
);

// Format currency
code = code.replace(
  /const formatted = new Intl\.NumberFormat\([\s\S]*?\}\)\.format\(amount\);/,
  'const formatted = fmtINR(amount, "USD");'
);

fs.writeFileSync(file, code);
