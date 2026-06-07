const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const roots = ['src/app', 'src/components'];
const files = [];
function walk(d){ for(const n of fs.readdirSync(d)){ const p=path.join(d,n); const s=fs.statSync(p); if(s.isDirectory()) walk(p); else if(/\.(tsx|ts)$/.test(n) && !n.endsWith('.d.ts')) files.push(p); } }
roots.forEach(r=>{ if(fs.existsSync(r)) walk(r); });
(async()=>{
  const bad=[];
  await Promise.all(files.map(async f=>{
    const code=fs.readFileSync(f,'utf8');
    try{ await esbuild.transform(code,{loader:f.endsWith('.tsx')?'tsx':'ts', jsx:'preserve'}); }
    catch(e){ bad.push({f, msg:(e.errors&&e.errors[0])?`${e.errors[0].text} @${e.errors[0].location?.line}`:String(e).slice(0,120)}); }
  }));
  console.log(`Scanned ${files.length} files. SYNTAX ERRORS: ${bad.length}`);
  bad.sort((a,b)=>a.f.localeCompare(b.f)).forEach(b=>console.log(`  ${b.f}\n      ${b.msg}`));
  fs.writeFileSync('/tmp/mod20ui/syntax_bad.json', JSON.stringify(bad.map(b=>b.f)));
})();
