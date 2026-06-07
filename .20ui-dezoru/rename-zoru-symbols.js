const fs=require('fs'), path=require('path'), cp=require('child_process');
const dry=process.argv.includes('--dry');
const roots=['src/components/sabcrm/20ui/composites','src/components/sabfiles/file-manager'];
const extra=['src/components/sabcrm/20ui/composites-public.ts'];
const files=[...extra];
for(const r of roots){(function rec(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(fs.statSync(p).isDirectory())rec(p);else if(/\.(tsx?)$/.test(n))files.push(p);}})(r);}
let changed=0;
for(const f of files){
  let s=fs.readFileSync(f,'utf8'); const o=s;
  s=s.replace(/ZORU_/g,'SAB_');          // all-caps constants
  s=s.replace(/Zoru/g,'Sab');            // PascalCase identifiers + displayName strings + comments (capital Z never in a zoru- path)
  s=s.replace(/zoru(?=[A-Z])/g,'sab');   // camelCase (zoruBadgeVariants) — NOT zoru- file paths (lookahead requires uppercase)
  if(s!==o){changed++; if(!dry)fs.writeFileSync(f,s);}
}
console.log(`${dry?'[DRY] ':''}files renamed: ${changed}/${files.length}`);
