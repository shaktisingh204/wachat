const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sabsms/templates/[id]/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add Suspense
code = code.replace(
  'import { getCachedSession } from "@/lib/server-cache";',
  'import React, { Suspense } from "react";\nimport { getCachedSession } from "@/lib/server-cache";'
);

// We'll write the new file contents directly using bash to be safe.
