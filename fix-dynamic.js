const fs = require('fs');
const glob = require('glob'); // Assuming we can just find them

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = require('path').join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('src', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // The pattern is basically `\n\nexport const dynamic = 'force-dynamic';\n` injected in the middle of imports.
  // Actually, wait, it's easier: if it's inside `import { ... }` or `import type { ... }` 
  
  // Let's just find `\n\nexport const dynamic = 'force-dynamic';\n`
  // and remove it, and then add it to the top after the imports.
  
  if (content.includes("export const dynamic = 'force-dynamic';")) {
     // Let's see if there's any TS error
     // To be safe, if we find `export const dynamic = 'force-dynamic';` inside an import block:
     const rx = /(import\s+(?:type\s+)?\{[^}]*?)(\n\s*export const dynamic = 'force-dynamic';\s*\n)([^}]*\})/g;
     if (rx.test(content)) {
        content = content.replace(rx, "$1\n$3");
        // now add it outside
        content = content.replace(/(from\s+['"][^'"]+['"];\s*\n)/, "$1\nexport const dynamic = 'force-dynamic';\n");
        fs.writeFileSync(filePath, content);
        console.log("Fixed inside import:", filePath);
     }
  }
});
