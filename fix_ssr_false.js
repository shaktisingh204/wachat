const fs = require('fs');

const files = [
    "src/app/dashboard/crm/dashboards/[id]/page.tsx",
    "src/app/dashboard/crm/dashboards/[id]/edit/page.tsx",
    "src/app/dashboard/crm/dashboards/[id]/public/page.tsx",
    "src/app/dashboard/crm/products/[productId]/page.tsx",
    "src/app/dashboard/portfolio/manage/[portfolioId]/builder/page.tsx"
];

for (const f of files) {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        content = content.replace(/ssr:\s*false\s*,?/g, '');
        fs.writeFileSync(f, content);
        console.log("Fixed ssr: false in " + f);
    }
}
