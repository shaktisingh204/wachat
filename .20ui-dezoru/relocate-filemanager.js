const fs=require('fs'), path=require('path');
const C='src/components/sabcrm/20ui/composites';
const dry=process.argv.includes('--dry');
// the file-manager set (top-level files + dirs) that MOVE to sabfiles/file-manager/
const setTop=['file-upload-card.tsx','file-card-collections.tsx'];
const setDirs=['file-picker','files-module'];
const movePaths=new Set();
for(const f of setTop) movePaths.add(path.resolve(C+'/'+f));
for(const d of setDirs){ (function rec(dir){for(const n of fs.readdirSync(dir)){const p=path.join(dir,n); if(fs.statSync(p).isDirectory())rec(p); else movePaths.add(path.resolve(p));}})(C+'/'+d); }
function rf(spec,from){let s=spec; if(s.startsWith('.'))s=path.join(path.dirname(from),s); else return null;
  for(const c of [s,s+'.ts',s+'.tsx',path.join(s,'index.ts'),path.join(s,'index.tsx')]){try{if(fs.statSync(c).isFile())return path.resolve(c);}catch{}} return null;}
// rewrite imports in each moving file: primitive (outside set) -> absolute composites path; intra-set -> keep relative
const movingFiles=[...movePaths].filter(p=>/\.(tsx?)$/.test(p));
let rewrites=0;
for(const f of movingFiles){
  let src=fs.readFileSync(f,'utf8'); const orig=src;
  src=src.replace(/(from\s*['"])(\.[^'"]+)(['"])/g,(m,a,spec,b)=>{
    const tgt=rf(spec,f); if(!tgt) return m;
    if(movePaths.has(tgt)) return m; // intra-set, keep relative
    // primitive staying in composites -> absolute path
    const relToComposites=path.relative(path.resolve(C), tgt).replace(/\.(tsx?)$/,'').replace(/\/index$/,'');
    return a+'@/components/sabcrm/20ui/composites/'+relToComposites+b;
  });
  if(src!==orig){ rewrites++; if(!dry) fs.writeFileSync(f,src); }
}
console.log(`${dry?'[DRY] ':''}files with primitive-imports rewritten to absolute: ${rewrites}/${movingFiles.length}`);
// show a sample of what primitive paths are referenced
const prims=new Set();
for(const f of movingFiles){const src=fs.readFileSync(f,'utf8'); for(const m of src.matchAll(/from\s*['"]@\/components\/sabcrm\/20ui\/composites\/([^'"]+)['"]/g))prims.add(m[1]);}
console.log('primitive deps (stay in composites):', [...prims].sort().join(', '));
