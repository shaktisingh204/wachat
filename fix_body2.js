const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/_components/item-detail-body.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFunc = `function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return \`\${currency} \${value}\`;
  }
}`;
content = content.replace(oldFunc, '');
content = content.replace(/fmtMoney/g, 'fmtINR');

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
