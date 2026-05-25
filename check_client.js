const fs = require('fs');
const path = require('path');

const chunk31Folders = [
  'favicon-generator', 'find-and-replace', 'ga-tag-generator', 'gtm-snippet',
  'hash-generator', 'hreflang-generator', 'htaccess-redirect', 'html-formatter',
  'html-minifier', 'html-to-markdown', 'html-to-text', 'http-headers',
  'image-alt-checker', 'image-compressor', 'image-format-converter', 'image-metadata',
  'image-resizer', 'image-to-base64', 'indexed-pages', 'internal-link-analyzer',
  'js-minifier', 'json-formatter', 'keyword-cpc', 'keyword-density',
  'keyword-difficulty', 'keyword-extractor', 'keyword-generator', 'keyword-grouper',
  'keyword-mixer', 'keyword-negative', 'keyword-rank-checker', 'keyword-trends',
  'link-extractor', 'log-analyzer', 'long-tail-keywords', 'lorem-ipsum',
  'lsi-keywords', 'markdown-to-html', 'meta-tag-analyzer', 'meta-tag-generator',
  'mobile-friendly', 'nginx-redirect', 'og-image-generator', 'og-tag-generator',
  'on-page-audit'
];

const basePath = path.join(process.cwd(), 'src/app/dashboard/seo/tools');

let clientComponents = [];
let serverComponents = [];

chunk31Folders.forEach(folder => {
  const folderPath = path.join(basePath, folder);
  if (!fs.existsSync(folderPath)) return;
  const pagePath = path.join(folderPath, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf-8');
    if (content.includes("'use client'") || content.includes('"use client"')) {
      clientComponents.push(folder);
    } else {
      serverComponents.push(folder);
    }
  }
});

console.log('Client Components:', clientComponents.length);
console.log('Server Components:', serverComponents.length);
if (serverComponents.length > 0) console.log(serverComponents);
