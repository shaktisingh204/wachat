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
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src/app/dashboard/hrm');
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if it imports fmtDate AND has function fmtDate
    if (content.includes('import { fmtDate }') && content.includes('function fmtDate')) {
        // remove the function definition: 
        // function fmtDate(value: unknown): string {
        //     if (!value) return '—';
        //     const d = new Date(value as string);
        //     return Number.isNaN(d.getTime()) ? '—' : fmtDate(d);
        // }
        // or similar
        content = content.replace(/function fmtDate\([^\)]*\)(?::\s*string)?\s*\{[\s\S]*?\n\}/g, '');
        fs.writeFileSync(file, content);
        console.log(`Fixed fmtDate in ${file}`);
    }
}
