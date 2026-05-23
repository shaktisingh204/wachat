const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/_components/item-detail-body.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace fmtMoney usages with fmtINR
content = content.replace(/fmtMoney/g, 'fmtINR');

// Remove fmtINR definition since we just renamed fmtMoney
content = content.replace(/function fmtINR[\s\S]*?\} catch \{[\s\S]*?\}[\s\S]*?\}/, '');

// Import fmtINR
content = content.replace(/(import Link from 'next\/link';)/, "$1\nimport { fmtINR } from '@/lib/utils';");

// Import Tabs
content = content.replace(/(import { fmtINR } from '@\/lib\/utils';)/, "$1\nimport { ItemDetailTabs } from './item-detail-tabs';\nimport { TabsContent } from '@/components/ui/tabs';");

// Add defaultTab
content = content.replace(/interface ItemDetailBodyProps \{/, "interface ItemDetailBodyProps {\n  defaultTab?: string;");
content = content.replace(/export function ItemDetailBody\(\{\n?  product,\n?  productId,\n?\}\: ItemDetailBodyProps\) \{/m, "export function ItemDetailBody({ product, productId, defaultTab }: ItemDetailBodyProps) {");
content = content.replace(/export function ItemDetailBody\(\{ product, productId \}: ItemDetailBodyProps\) \{/, "export function ItemDetailBody({ product, productId, defaultTab }: ItemDetailBodyProps) {");

// Wrap sections in Tabs
content = content.replace(
  /<>\s*\{\/\* Overview \*\/\}/,
  `<ItemDetailTabs defaultTab={defaultTab}>\n      <TabsContent value="overview" className="space-y-4">\n      {/* Overview */}`
);

content = content.replace(
  /\{\/\* Pricing \*\/\}/,
  `</TabsContent>\n      <TabsContent value="pricing" className="space-y-4">\n      {/* Pricing */}`
);

content = content.replace(
  /\{\/\* Inventory per warehouse \*\/\}/,
  `</TabsContent>\n      <TabsContent value="inventory" className="space-y-4">\n      {/* Inventory per warehouse */}`
);

content = content.replace(
  /\{\/\* Accounting refs \*\/\}/,
  `</TabsContent>\n      <TabsContent value="accounting" className="space-y-4">\n      {/* Accounting refs */}`
);

content = content.replace(
  /<\/Card>\s*<\/>/,
  `</Card>\n      </TabsContent>\n    </ItemDetailTabs>`
);

fs.writeFileSync(file, content);
