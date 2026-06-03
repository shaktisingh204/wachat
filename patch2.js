const fs = require('fs');
let code = fs.readFileSync('src/config/dashboard-config.ts', 'utf-8');

if (!code.includes("id: 'sabops'")) {
    code = code.replace(/\{ id: 'sabbi'.*\},/, "{ id: 'sabbi', icon: BarChart2, label: 'SabBI', href: '/dashboard/sabbi/datasets' },\n    { id: 'sabops', icon: ShieldCheck, label: 'SabOps', href: '/dashboard/sabops' },");
}

fs.writeFileSync('src/config/dashboard-config.ts', code);
console.log('patched');
