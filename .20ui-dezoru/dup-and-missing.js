const fs=require('fs'), path=require('path'), cp=require('child_process');
const DS='src/components/sabcrm/20ui';
// ---- resolve barrel export set (transitive) ----
const cache=new Map();
function resolveFile(spec,from){let s=spec; if(s.startsWith('@/'))s=s.replace('@/','src/'); if(s.startsWith('.'))s=path.join(path.dirname(from),s); else if(!s.startsWith('src/'))return null;
  for(const c of [s+'.ts',s+'.tsx',path.join(s,'index.ts'),path.join(s,'index.tsx'),s]){try{if(fs.statSync(c).isFile())return c;}catch{}} return null;}
function exportsOf(file,seen=new Set()){if(cache.has(file))return cache.get(file); if(seen.has(file))return{names:new Set(),wildcard:false}; seen.add(file);
  const res={names:new Set(),wildcard:false}; let src; try{src=fs.readFileSync(file,'utf8');}catch{return res;}
  src=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  for(const m of src.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)){const f=resolveFile(m[1],file); if(!f){res.wildcard=true;continue;} const sub=exportsOf(f,seen); sub.names.forEach(n=>res.names.add(n)); if(sub.wildcard)res.wildcard=true;}
  for(const m of src.matchAll(/export\s*(?:type\s+)?\{([^}]*)\}/g)){for(let s of m[1].split(',')){s=s.trim().replace(/^type\s+/,''); if(!s)continue; const as=s.match(/\s+as\s+([A-Za-z0-9_]+)$/); res.names.add(as?as[1]:s);}}
  for(const m of src.matchAll(/export\s+(?:declare\s+)?(?:const|let|var|function\*?|class|interface|type|enum|abstract\s+class)\s+([A-Za-z0-9_]+)/g))res.names.add(m[1]);
  if(/export\s+default/.test(src))res.names.add('default');
  cache.set(file,res); return res;}
const barrel=exportsOf(path.join(DS,'index.ts'));
console.log(`barrel exports: ${barrel.names.size}${barrel.wildcard?' (+WILDCARD - missing-check unreliable)':''}`);

const files=cp.execSync(`git ls-files 'src/**/*.tsx' 'src/**/*.ts'`,{encoding:'utf8',maxBuffer:512*1024*1024}).trim().split('\n').filter(Boolean);
const dupHits=[], missHits={};
for(const f of files){
  if(f.includes('sabcrm/20ui/'))continue;
  let raw; try{raw=fs.readFileSync(f,'utf8');}catch{continue;}
  const src=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  // collect top-level binding names
  const counts={};
  const add=n=>{n=n.trim(); if(n)counts[n]=(counts[n]||0)+1;};
  // named imports
  for(const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)){
    for(let s of m[1].split(',')){s=s.trim().replace(/^type\s+/,''); if(!s)continue; const as=s.match(/\s+as\s+([A-Za-z0-9_$]+)$/); add(as?as[1]:s);}
  }
  // default + namespace imports
  for(const m of src.matchAll(/import\s+(?!type[\s{])([A-Za-z0-9_$]+)\s*,?\s*(?:\{[^}]*\})?\s*from\s*['"][^'"]+['"]/g))add(m[1]);
  for(const m of src.matchAll(/import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from/g))add(m[1]);
  // top-level const/let/var/function/class (column 0 or after export, no indent)
  for(const m of src.matchAll(/^(?:export\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/gm))add(m[1]);
  for(const [n,c] of Object.entries(counts))if(c>1)dupHits.push(`${f}: '${n}' x${c}`);
  // missing barrel exports
  if(!barrel.wildcard){
    for(const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*?)\}\s*from\s*['"]@\/components\/sabcrm\/20ui['"]/g)){
      for(let s of m[1].split(',')){s=s.trim().replace(/^type\s+/,'').replace(/\s+as\s+.*$/,'').trim(); if(!s)continue; if(!barrel.names.has(s))(missHits[s]=missHits[s]||[]).push(f);}
    }
  }
}
console.log(`\nDUPLICATE top-level bindings: ${dupHits.length}`); dupHits.forEach(h=>console.log('  '+h));
const me=Object.entries(missHits).sort((a,b)=>b[1].length-a[1].length);
console.log(`\nMISSING barrel exports: ${me.length}`); me.forEach(([n,fl])=>console.log(`  ${n} (${fl.length}): ${fl.slice(0,4).join(', ')}`));
