const fs = require('fs');
let file = 'src/app/dashboard/crm/inventory/items/_components/item-detail-tabs.tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/router\.replace.*/, "router.replace(`${pathname}?${params.toString()}`, { scroll: false });");
fs.writeFileSync(file, c);
