const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/app/wachat/message-statistics/page.tsx',
  'src/app/wachat/integrations/whatsapp-widget-generator/page.tsx'
];

filesToFix.forEach(relPath => {
  const file = path.join(__dirname, relPath);
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('import { formatUTC }')) {
    content = content.replace(/import \{([^}]+)\} from 'react';/, "import {$1} from 'react';\nimport { formatUTC } from '@/lib/utils';");
  }

  content = content.replace(/new Date\(([^)]+)\)\.toLocaleString\(\)/g, 'formatUTC($1, true)');
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\(\)/g, 'formatUTC($1, false)');

  fs.writeFileSync(file, content);
  console.log('Fixed', relPath);
});
