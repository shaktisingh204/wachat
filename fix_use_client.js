const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src');
let fixed = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Check for 'use client' being after imports
    const useClientRegex = /^(import[\s\S]*?)((['"])use client\3;?[\r\n]*)/m;
    const match = content.match(useClientRegex);
    if (match) {
        // We only want to swap if 'use client' is in the first 20 lines to be safe
        const lines = content.split('\n');
        let useClientLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('use client')) {
                useClientLineIndex = i;
                break;
            }
        }
        
        if (useClientLineIndex > 0) {
            // Re-read carefully
            let newLines = [...lines];
            let ucLine = newLines.splice(useClientLineIndex, 1)[0];
            newLines.unshift(ucLine);
            content = newLines.join('\n');
            changed = true;
        }
    }
    
    // Check for specific sequence:
    // import { fmtDate } from '@/lib/utils';
    // 'use client';
    const specificRegex = /(import\s+\{[^}]*\}\s+from\s+['"]@\/lib\/utils['"];?[\r\n]+)(['"]use client['"];?[\r\n]+)/;
    if (specificRegex.test(content)) {
         content = content.replace(specificRegex, '$2$1');
         changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
        fixed++;
    }
}
console.log(`Fixed use client in ${fixed} files.`);
