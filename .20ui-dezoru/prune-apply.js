const fs=require('fs'), path=require('path');
const C='src/components/sabcrm/20ui/composites';
const dead=require('/tmp/mod20ui/composites_dead.json');
const deadSet=new Set(dead.map(f=>path.resolve(f)));
function rf(spec,from){let s=spec; if(s.startsWith('@/'))s=s.replace('@/','src/'); else if(s.startsWith('.'))s=path.join(path.dirname(from),s); else return null;
  for(const c of [s,s+'.ts',s+'.tsx',path.join(s,'index.ts'),path.join(s,'index.tsx')]){try{if(fs.statSync(c).isFile())return c;}catch{}} return null;}
// rewrite index.ts: drop `export ... from '<deadfile>'` statements
const idxPath=C+'/index.ts';
let idx=fs.readFileSync(idxPath,'utf8');
let removed=0;
idx=idx.replace(/export\s*(?:type\s*)?(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"];?/g, (stmt,spec)=>{
  const r=rf(spec, idxPath);
  if(r && deadSet.has(path.resolve(r))){ removed++; return ''; }
  return stmt;
});
idx=idx.replace(/\n{3,}/g,'\n\n');
fs.writeFileSync(idxPath, idx);
console.log('removed dead index.ts re-export statements:', removed);
// delete dead files
let del=0;
for(const f of dead){ try{ fs.unlinkSync(f); del++; }catch(e){ console.log('  skip',f,e.message); } }
console.log('deleted dead files:', del);
// clean up empty dirs
function cleanDirs(d){ for(const n of fs.readdirSync(d)){ const p=path.join(d,n); if(fs.statSync(p).isDirectory()){ cleanDirs(p); try{ if(fs.readdirSync(p).length===0){ fs.rmdirSync(p); console.log('  rmdir',p.replace(C+'/','')); } }catch{} } } }
cleanDirs(C);
