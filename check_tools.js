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

let missingErrors = [];
let missingLoadings = [];
let noForceDynamic = [];

chunk31Folders.forEach(folder => {
  const folderPath = path.join(basePath, folder);
  if (!fs.existsSync(folderPath)) return;
  
  const pagePath = path.join(folderPath, 'page.tsx');
  const errorPath = path.join(folderPath, 'error.tsx');
  const loadingPath = path.join(folderPath, 'loading.tsx');

  if (!fs.existsSync(errorPath)) missingErrors.push(folder);
  if (!fs.existsSync(loadingPath)) missingLoadings.push(folder);

  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf-8');
    if (!content.includes('export const dynamic = \'force-dynamic\'') && !content.includes('export const dynamic="force-dynamic"')) {
      noForceDynamic.push(folder);
    }
  }
});

console.log('Missing error.tsx:', missingErrors.length);
console.log('Missing loading.tsx:', missingLoadings.length);
console.log('Missing force-dynamic:', noForceDynamic.length);

