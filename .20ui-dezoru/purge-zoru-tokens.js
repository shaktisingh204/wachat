const fs=require('fs'), cp=require('child_process');
// zoru token root -> st token name. ONLY tokens DEFINED in zoru-legacy.css (67) + tailwind -foreground aliases.
const MAP={
  'surface-2-foreground':'text', 'primary-foreground':'text-inverted', 'danger-foreground':'text-inverted',
  'success-foreground':'text-inverted',
  'ink-muted':'text-secondary','ink-subtle':'text-tertiary','ink-strong':'text',
  'line-strong':'border-strong','primary-hover':'accent-hover','primary-active':'accent-hover',
  'danger-ink':'danger-strong','success-ink':'status-ok','warning-ink':'warn','info-ink':'accent',
  'on-primary':'text-inverted','on-danger':'text-inverted','on-success':'text-inverted',
  'on-warning':'text-inverted','on-info':'text-inverted',
  'radius-sm':'radius-sm','radius-lg':'radius-lg','radius-xl':'radius-lg',
  'shadow-sm':'shadow-sm','shadow-md':'shadow-md','shadow-lg':'shadow-lg','shadow-xl':'shadow-lg',
  'ring-alpha':'accent-ring','surface-2':'bg-muted','surface-3':'bg-muted',
  'bg':'bg','surface':'surface','ink':'text','line':'border','primary':'accent',
  'danger':'danger','success':'status-ok','warning':'warn','info':'accent','ring':'accent-ring',
  'radius':'radius', 'shadow':'shadow',
};
// order keys longest-first so multi-segment roots win
const KEYS=Object.keys(MAP).sort((a,b)=>b.length-a.length);
const dry=process.argv.includes('--dry');
const files=cp.execSync(`git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'src/**/*.css'`,{encoding:'utf8',maxBuffer:512*1024*1024}).trim().split('\n').filter(Boolean)
  .filter(f=>!f.includes('sabcrm/20ui/zoru-legacy.css')); // we delete that file separately
let changed=0; const unmapped=new Set();
for(const f of files){
  let s; try{s=fs.readFileSync(f,'utf8');}catch{continue;}
  const orig=s;
  // 1) var/double-dash form: --zoru-ROOT  (covers var(--zoru-x) and [var(--zoru-x)])
  for(const k of KEYS){ s=s.split('--zoru-'+k).join('--st-'+MAP[k]); }
  // 2) tailwind class single-dash form: -zoru-ROOT  -> -[var(--st-Y)]
  for(const k of KEYS){ s=s.split('-zoru-'+k).join('-[var(--st-'+MAP[k]+')]'); }
  // detect any leftover zoru tokens not in our map (richer/foreign)
  for(const m of s.matchAll(/--zoru-([a-z0-9-]+)/g)) unmapped.add(m[1]);
  for(const m of s.matchAll(/-zoru-([a-z0-9-]+)/g)) unmapped.add(m[1]);
  if(s!==orig){ changed++; if(!dry) fs.writeFileSync(f,s); }
}
console.log(`${dry?'[DRY] ':''}files changed: ${changed} / scanned ${files.length}`);
console.log(`leftover UNMAPPED zoru token roots (intentionally untouched - sourced elsewhere): ${[...unmapped].sort().join(', ')||'none'}`);
