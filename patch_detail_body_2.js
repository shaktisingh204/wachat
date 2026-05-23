const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/_components/item-detail-body.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/interface ItemDetailBodyProps \{/, "interface ItemDetailBodyProps {\n  defaultTab?: string;");

content = content.replace(/export function ItemDetailBody\(\{\n?  product,\n?  productId,\n?\}\: ItemDetailBodyProps\) \{/m, "export function ItemDetailBody({ product, productId, defaultTab }: ItemDetailBodyProps) {");
content = content.replace(/export function ItemDetailBody\(\{ product, productId \}: ItemDetailBodyProps\) \{/, "export function ItemDetailBody({ product, productId, defaultTab }: ItemDetailBodyProps) {");

// Add import
content = content.replace(/(import Link from 'next\/link';)/, "$1\nimport { ItemDetailTabs } from './item-detail-tabs';\nimport { TabsContent } from '@/components/ui/tabs';");

// Wrap the cards
// Note: Overview gets everything up to Pricing.
content = content.replace(/<>\s*\{\/\* Overview \*\/\}/, "<ItemDetailTabs defaultTab={defaultTab}>\n      <TabsContent value=\"overview\" className=\"space-y-4\">\n      {/* Overview */}");

content = content.replace(/\{\/\* Pricing \*\/\}/, "</TabsContent>\n      <TabsContent value=\"pricing\" className=\"space-y-4\">\n      {/* Pricing */}");

content = content.replace(/\{\/\* Inventory per warehouse \*\/\}/, "</TabsContent>\n      <TabsContent value=\"inventory\" className=\"space-y-4\">\n      {/* Inventory per warehouse */}");

content = content.replace(/\{\/\* Accounting refs \*\/\}/, "</TabsContent>\n      <TabsContent value=\"accounting\" className=\"space-y-4\">\n      {/* Accounting refs */}");

content = content.replace(/<\/TabsContent>\s*<\/TabsContent>/g, "</TabsContent>");

content = content.replace(/<\/Card>\s*<\/(\>|\/React.Fragment\>)/m, "</Card>\n      </TabsContent>\n    </ItemDetailTabs>");

content = content.replace(/<\/Card>\s*<\/(\>|\/React.Fragment\>)/m, "</Card>\n      </TabsContent>\n    </ItemDetailTabs>");
content = content.replace(/<\/Card>\s*<\/>/m, "</Card>\n      </TabsContent>\n    </ItemDetailTabs>");

fs.writeFileSync(file, content);
