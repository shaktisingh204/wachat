const fs = require('fs');
let code = fs.readFileSync('src/components/ui/sidebar-component.tsx', 'utf8');

if (!code.includes('sabbi:')) {
    code = code.replace(
        /sabcreator:      \{ name: "yellow".*?\},/g,
        `sabcreator:      { name: "yellow",   gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabbi:           { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },`
    );
    fs.writeFileSync('src/components/ui/sidebar-component.tsx', code);
    console.log('Added sabbi to MODULE_HUE');
} else {
    console.log('sabbi already in MODULE_HUE');
}
