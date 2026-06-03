const fs = require('fs');
let code = fs.readFileSync('src/components/ui/sidebar-component.tsx', 'utf-8');

if (!code.includes('sabops: fromGroups(sabopsMenuGroups)')) {
    code = code.replace(/settings:\s*settingsSections,\n};/g, 'sabops: fromGroups(sabopsMenuGroups),\n  settings: settingsSections,\n};');
}
if (!code.includes('sabops:          { name: "indigo"')) {
    code = code.replace(/sabsign:\s*{[^}]+},\n};\n\nconst FALLBACK_HUE/g, 'sabsign:         { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },\n  sabops:          { name: "indigo",   gradient: "from-zoru-ink to-zoru-ink",  ink: "text-zoru-ink",   inkMuted: "text-zoru-ink/70",   soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",   titleInk: "text-zoru-ink/80" },\n};\n\nconst FALLBACK_HUE');
}

fs.writeFileSync('src/components/ui/sidebar-component.tsx', code);
console.log('patched');
