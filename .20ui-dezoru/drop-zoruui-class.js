const fs=require('fs'), cp=require('child_process');
const dry=process.argv.includes('--dry');
const files=cp.execSync(`git ls-files 'src/**/*.tsx' 'src/**/*.ts'`,{encoding:'utf8',maxBuffer:512*1024*1024}).trim().split('\n').filter(Boolean);
let changed=0; const samples=[];
for(const f of files){
  let s; try{s=fs.readFileSync(f,'utf8');}catch{continue;}
  const orig=s;
  // bare `zoruui` class token: bounded by quote/backtick/space on both sides, NOT followed by '-' (zoruui-domain/zoruui-surface-sheen) or '/' (paths)
  // collapse the token + one adjacent space.
  s=s.replace(/(["'`\s])zoruui(?![-\w/])\s?/g, (m,p1)=> p1===' '? ' ' : p1);
  if(s!==orig){ changed++; if(samples.length<6)samples.push(f); if(!dry)fs.writeFileSync(f,s); }
}
console.log(`${dry?'[DRY] ':''}files with .zoruui class dropped: ${changed}`);
samples.forEach(f=>console.log('  '+f));
