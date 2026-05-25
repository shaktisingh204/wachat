const fs = require('fs');
const files = [
  'src/app/sabsms/analytics/cost/page.tsx',
  'src/app/sabsms/analytics/funnel/page.tsx',
  'src/app/sabsms/campaigns/page.tsx',
  'src/app/sabsms/compliance/10dlc/page.tsx',
  'src/app/sabsms/compliance/audit/page.tsx',
  'src/app/wachat/setup/docs/page.tsx',
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  // Match `import {\n\nexport const dynamic = 'force-dynamic';\n\n  `
  const regex = /import\s*{\s*export const dynamic = 'force-dynamic';\s*/m;
  if (regex.test(content)) {
    content = content.replace(regex, "export const dynamic = 'force-dynamic';\n\nimport {\n  ");
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  }
}
