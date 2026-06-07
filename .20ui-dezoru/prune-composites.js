const fs=require('fs'), path=require('path');
const C='src/components/sabcrm/20ui/composites';
const dry=process.argv.includes('--dry');
function rf(spec,from){let s=spec; if(s.startsWith('@/'))s=s.replace('@/','src/'); else if(s.startsWith('.'))s=path.join(path.dirname(from),s); else return null;
  for(const c of [s,s+'.ts',s+'.tsx',path.join(s,'index.ts'),path.join(s,'index.tsx')]){try{if(fs.statSync(c).isFile())return c;}catch{}} return null;}
// 1. names composites-public needs from './composites' + direct file deps
const pub=fs.readFileSync(C+'-public.ts','utf8');
const neededNames=new Set();
for(const m of pub.matchAll(/(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]\.\/composites['"]/g))
  for(let s of m[1].split(',')){s=s.trim().replace(/^type\s+/,'').replace(/\s+as\s+.*/,'').trim(); if(s)neededNames.add(s);}
// direct file imports in public (zoru-apps, app-theme)
const directFiles=new Set();
for(const m of pub.matchAll(/from\s*['"](\.\/composites\/[^'"]+)['"]/g)){const r=rf(m[1],C+'-public.ts'); if(r)directFiles.add(r);}
// 2. index.ts name -> source file map
const idx=fs.readFileSync(C+'/index.ts','utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const nameToFile=new Map(); const idxLines=[];
for(const m of idx.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)){
  const src=rf(m[2],C+'/index.ts');
  const names=m[1].split(',').map(s=>{s=s.trim().replace(/^type\s+/,''); const as=s.match(/\s+as\s+([A-Za-z0-9_]+)$/); return (as?as[1]:s).trim();}).filter(Boolean);
  idxLines.push({raw:m[0], names, src});
  if(src) names.forEach(n=>nameToFile.set(n,src));
}
// 3. seed worklist with source files of needed names + direct files
const alive=new Set([C+'/index.ts', path.resolve(C+'/index.ts')]); const work=[];
function addFile(f){ if(f && !alive.has(f)){ alive.add(f); work.push(f);} }
for(const n of neededNames){ const f=nameToFile.get(n); if(f) addFile(f); else console.error('  [warn] needed name not in index map:',n); }
for(const f of directFiles) addFile(f);
// 4. transitive closure (name-aware through index.ts)
while(work.length){
  const f=work.pop(); let src; try{src=fs.readFileSync(f,'utf8');}catch{continue;}
  src=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  for(const m of src.matchAll(/import\s*(?:type\s*)?(?:\{([^}]*)\}|\*\s*as\s*\w+|\w+)?\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/g)){
    const spec=m[2]; const r=rf(spec,f); if(!r) continue;
    if(r.endsWith('/composites/index.ts') || r.endsWith('/composites/index.tsx')){
      // resolve named imports through the index map
      if(m[1]) for(let s of m[1].split(',')){s=s.trim().replace(/^type\s+/,'').replace(/\s+as\s+.*/,'').trim(); const tf=nameToFile.get(s); if(tf)addFile(tf);}
    } else addFile(r);
  }
  // also follow side-effect/export-from? handle export {..} from inside files
  for(const m of src.matchAll(/export\s*(?:type\s*)?(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)){const r=rf(m[1],f); if(r) addFile(r);}
}
// 5. all composites files
const all=[]; (function rec(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n); const st=fs.statSync(p); if(st.isDirectory())rec(p); else if(/\.(tsx?|ts)$/.test(n))all.push(p);}})(C);
const dead=all.filter(f=>!alive.has(f) && !alive.has(path.resolve(f)));
console.log(`needed names: ${neededNames.size}, alive files: ${[...alive].filter(f=>f.startsWith(C)).length}, total: ${all.length}, DEAD: ${dead.length}`);
dead.sort().forEach(f=>console.log('  DEAD '+f.replace(C+'/','')));
fs.writeFileSync('/tmp/mod20ui/composites_dead.json',JSON.stringify(dead));
fs.writeFileSync('/tmp/mod20ui/composites_idxlines.json',JSON.stringify(idxLines.map(l=>({raw:l.raw,src:l.src,dead:l.src&&!alive.has(l.src)&&!alive.has(path.resolve(l.src))}))));
// 6. SAFETY: does any ALIVE file import a DEAD file? (closure correctness)
const deadSet=new Set(dead.concat(dead.map(f=>path.resolve(f))));
let violations=0;
for(const f of all){
  if(deadSet.has(f)||deadSet.has(path.resolve(f))) continue; // skip dead
  let src; try{src=fs.readFileSync(f,'utf8');}catch{continue;}
  src=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  for(const m of src.matchAll(/from\s*['"](\.[^'"]+)['"]/g)){
    const r=rf(m[1],f); if(r && (deadSet.has(r)||deadSet.has(path.resolve(r)))){ console.log(`  VIOLATION: alive ${f.replace(C+'/','')} imports DEAD ${r.replace(C+'/','')}`); violations++; }
  }
}
console.log(`\nALIVE->DEAD import violations: ${violations} (must be 0 to prune safely)`);
