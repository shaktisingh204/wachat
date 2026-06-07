const fs = require('fs'), path = require('path'), cp = require('child_process');
// 1) rename zoru-*.{tsx,ts} files -> ui20-*  (git mv), collect basename map
const all = cp.execSync("git ls-files 'src/**'", { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  .trim().split('\n').filter(Boolean);
const fileRenames = [];
for (const f of all) {
  const base = path.basename(f);
  if (/^zoru-/.test(base)) {
    const nb = base.replace(/^zoru-/, 'ui20-');
    const np = path.join(path.dirname(f), nb);
    cp.execSync(`git mv "${f}" "${np}"`);
    fileRenames.push([base.replace(/\.(tsx?|css)$/, ''), nb.replace(/\.(tsx?|css)$/, '')]);
  }
}
console.log('files renamed:', fileRenames.length);
// 2) text pass across all src ts/tsx/css
const files = cp.execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'src/**/*.css'", { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  .trim().split('\n').filter(Boolean);
let changed = 0;
for (const f of files) {
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const o = s;
  // import-path basenames for the renamed files (e.g. /zoru-chat-client -> /ui20-chat-client)
  for (const [oldB, newB] of fileRenames) s = s.split('/' + oldB).join('/' + newB);
  // symbol + brand replacements, ordered
  s = s.replace(/ZoruUI/g, 'Ui20').replace(/zoruui/g, 'ui20');
  s = s.replace(/ZORU_/g, 'UI20_').replace(/\bZORU\b/g, 'UI20');
  s = s.replace(/Zoru/g, 'Ui20');            // PascalCase identifiers, aliases, comments
  s = s.replace(/zoru(?=[A-Z])/g, 'ui20');   // camelCase (zoruToast)
  s = s.replace(/\bzoru\b/g, 'ui20');        // standalone lowercase word (comments)
  if (s !== o) { changed++; fs.writeFileSync(f, s); }
}
console.log('files text-updated:', changed);
