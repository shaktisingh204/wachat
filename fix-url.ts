const fs = require('fs');
const path = 'src/app/dashboard/seo/tools/serp-preview/page.tsx';
let content = fs.readFileSync(path, 'utf-8');
content = content.replace(
  /setTruncatedUrl\(`\$\{u\.hostname\} > \$\{u\.pathname\.split\('\/'\)\.filter\(Boolean\)\.join\(' > '\)\}`\);/,
  "setTruncatedUrl(`${u.hostname.replace('www.', '')} › ${u.pathname.split('/').filter(Boolean).join(' › ')}`);"
);
fs.writeFileSync(path, content);
