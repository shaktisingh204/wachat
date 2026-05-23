const fs = require('fs');

const data = JSON.parse(fs.readFileSync('chunks.json', 'utf8'));
const chunk1 = data.find(c => c.agent_id === 1);
const files = chunk1.files;

let output = '';

for (const file of files) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        output += `\n\n==== FILE: ${file} ====\n\n` + content;
    } else {
        output += `\n\n==== FILE: ${file} ====\n\nFILE NOT FOUND`;
    }
}

fs.writeFileSync('chunk1_files.txt', output);
console.log('Done!');
