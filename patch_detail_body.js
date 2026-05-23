const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/_components/item-detail-body.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { Tabs, TabsList, TabsTrigger, TabsContent }')) {
  content = content.replace(
    /(import Image from 'next\/image';)/,
    "$1\nimport { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';"
  );
  
  // Also import useSearchParams if needed, but it's a server component?
  // "ItemDetailBody — body cards on the item detail page. Pure server component."
  // Wait, if it's a pure server component, we can use Tabs? Yes, Tabs works in RSC if it's a client boundary inside its own component, but actually Tabs from radix is 'use client' so it works when imported into a server component (it just becomes a client boundary).
  // But wait, the feature is "Enable deep linking for specific tabs." Deep linking usually means `?tab=pricing`.
  // If we pass `tab` as a prop `defaultTab` from page.tsx to `ItemDetailBody`?
  // Let's modify page.tsx first.
}
