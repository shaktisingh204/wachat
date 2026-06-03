const fs = require('fs');
let code = fs.readFileSync('src/config/dashboard-config.ts', 'utf8');

code = code.replace(
    /\{ id: 'sabtables', icon: Database, label: 'SabTables', href: '\/dashboard\/sabtables\/bases' \},?\n\];/g,
    `{ id: 'sabtables', icon: Database, label: 'SabTables', href: '/dashboard/sabtables/bases' },
    { id: 'sabbi', icon: BarChart2, label: 'SabBI', href: '/dashboard/sabbi/datasets' },
];`
);

code = code.replace(
    /export const crmMenuGroups: MenuGroup\[\] = \[/g,
    `export const sabbiMenuGroups: MenuGroup[] = [
    {
        title: "Data Intelligence",
        items: [
            { href: "/dashboard/sabbi/datasets", label: "Datasets", icon: Database, exact: true, permissionKey: 'sabbi_datasets' },
            { href: "/dashboard/sabbi/charts", label: "Charts", icon: BarChart2, exact: true, permissionKey: 'sabbi_charts' },
            { href: "/dashboard/sabbi/embeds", label: "Embeds", icon: LayoutDashboard, exact: true, permissionKey: 'sabbi_embeds' },
        ]
    }
];

export const crmMenuGroups: MenuGroup[] = [`
);

fs.writeFileSync('src/config/dashboard-config.ts', code);
