const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function fixFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Fix missing closing brace and missing from statement
  // This happened because the script I ran previously replaced `import { ...` with `import { ...` and stripped out the `} from ...` part somehow.
  // Wait, let's look at the errors:
  
  // A pattern like:
  // getScheduledPosts,
  // publishScheduledPost,
  // import type ...
  //
  // Needs to become:
  // getScheduledPosts,
  // publishScheduledPost,
  // } from "@/app/actions/facebook.actions";
  // import type ...
  
  // Or:
  // getScheduledPosts,
  // import type ...
  
  // We can just use a regex to find a block of imports that is abruptly terminated by another import
  content = content.replace(/(import\s+\{[^{}]*?,\s*\n)(import\s)/g, (match, p1, p2) => {
    return p1 + "} from \"@/app/actions/FIXME\";\n" + p2;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed missing closing import in ${filePath}`);
  }
}

walkDir(path.join(__dirname, 'src/app'), fixFile);
