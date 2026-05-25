const fs = require('fs');

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

  // Check if it has 'use client'
  if (content.includes("'use client'") || content.includes('"use client"')) {
     if (content.includes("export const dynamic = 'force-dynamic';")) {
        content = content.replace(/export const dynamic = 'force-dynamic';\s*\n?/g, "");
        fs.writeFileSync(filePath, content);
        console.log("Removed dynamic from client component:", filePath);
     }
  }
});
