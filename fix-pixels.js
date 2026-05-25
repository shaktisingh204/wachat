const fs = require('fs');
let file = 'src/app/dashboard/ad-manager/pixels/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\`/g, '`');
content = content.replace(/\\\${/g, '${');

fs.writeFileSync(file, content);
