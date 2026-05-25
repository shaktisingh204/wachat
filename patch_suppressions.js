const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/suppressions/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add Suspense
code = code.replace(
  'import { getCachedSession } from "@/lib/server-cache";',
  'import { getCachedSession } from "@/lib/server-cache";\nimport React, { Suspense } from "react";\nimport { fmtQty } from "@/lib/utils";'
);

// We need to move everything from `const sp = await searchParams;` down into an async component.
// Instead of simple replacement, I'll rewrite it using file overwrite.
