const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/_components/item-detail-body.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<\/Card>\s*\)\s*:\s*null\}\s*<\/>/,
  `</Card>\n      ) : null}\n      </TabsContent>\n    </ItemDetailTabs>`
);

fs.writeFileSync(file, content);
