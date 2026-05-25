import fs from 'fs';

const lines = fs.readFileSync('src/app/dashboard/telegram/stickers/page.tsx', 'utf8').split('\n');

function extract(startStr, endStr) {
    // Just simple manual chunk extraction might be hard to automate via script perfectly.
}
