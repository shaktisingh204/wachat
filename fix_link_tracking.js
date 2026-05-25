const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/wachat/link-tracking/page.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { formatUTC }')) {
  content = content.replace("import { getProjectById } from '@/app/actions/project.actions';", "import { getProjectById } from '@/app/actions/project.actions';\nimport { formatUTC } from '@/lib/utils';");
}

content = content.replace(/new Date\(([^)]+)\)\.toLocaleString\(\)/g, 'formatUTC($1, true)');
content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\(\)/g, 'formatUTC($1, false)');

fs.writeFileSync(file, content);
console.log('Fixed link-tracking dates');
