const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let fixedCount = 0;

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    // We want to find:
    // import {
    //
    // export const dynamic = 'force-dynamic';
    //
    // ...
    // And move `export const dynamic = 'force-dynamic';` outside the import block.
    // There are many variations, let's use a regex that matches `export const dynamic` inside an import block.
    
    // Simpler: Just look for `import {\n\nexport const dynamic = 'force-dynamic';`
    const regex = /import\s*\{\s*export const dynamic = 'force-dynamic';\s*/m;
    if (regex.test(content)) {
      content = content.replace(regex, "export const dynamic = 'force-dynamic';\n\nimport {\n  ");
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log('Fixed:', filePath);
    }
  }
});

console.log('Total fixed:', fixedCount);
