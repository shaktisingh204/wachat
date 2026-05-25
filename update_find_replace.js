const fs = require('fs');

const path = 'src/app/dashboard/seo/tools/find-and-replace/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// The file will be mostly overwritten, so I'll just write the entire content.
