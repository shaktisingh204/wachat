const fs=require('fs'), cp=require('child_process');
const files=cp.execSync(`git ls-files 'src/**/*.tsx' 'src/**/*.ts'`,{encoding:'utf8',maxBuffer:512*1024*1024}).trim().split('\n').filter(Boolean);
const hits=[];
for(const f of files){
  let raw; try{raw=fs.readFileSync(f,'utf8');}catch{continue;}
  const src=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/[^\n]*/gm,'');
  const seen={}; // name -> count of distinct import statements binding it (as a VALUE, not type-only)
  for(const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)){
    const isTypeOnly=/import\s+type\s*\{/.test(m[0]);
    for(let s of m[1].split(',')){
      s=s.trim(); if(!s)continue;
      const inlineType=/^type\s+/.test(s);
      s=s.replace(/^type\s+/,''); const as=s.match(/\s+as\s+([A-Za-z0-9_$]+)$/); const local=as?as[1]:s.trim();
      if(isTypeOnly||inlineType)continue; // type-only bindings don't collide as values
      seen[local]=(seen[local]||0)+1;
    }
  }
  // also count default + namespace value imports
  for(const m of src.matchAll(/import\s+(?!type[\s{])([A-Za-z0-9_$]+)\s*(?:,\s*\{[^}]*\})?\s*from/g))seen[m[1]]=(seen[m[1]]||0)+1;
  for(const [n,c] of Object.entries(seen))if(c>1)hits.push(`${f}: '${n}' imported ${c}x`);
}
console.log(`DUPLICATE VALUE IMPORTS (build-breaking): ${hits.length}`);
hits.forEach(h=>console.log('  '+h));
