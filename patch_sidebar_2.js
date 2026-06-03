const fs = require('fs');
let code = fs.readFileSync('src/components/ui/sidebar-component.tsx', 'utf8');

code = code.replace(
    /sabsignMenuGroups,/,
    'sabsignMenuGroups, sabbiMenuGroups,'
);

code = code.replace(
    /sabsign: fromGroups\(sabsignMenuGroups\),/,
    'sabsign: fromGroups(sabsignMenuGroups),\n  sabbi: fromGroups(sabbiMenuGroups),'
);

fs.writeFileSync('src/components/ui/sidebar-component.tsx', code);
