'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Tabs, ZoruTabsContent as TabsContent, ZoruTabsList as TabsList, ZoruTabsTrigger as TabsTrigger } from '@/components/sabcrm/20ui/compat';

export function ItemDetailTabs({ defaultTab, children }: { defaultTab?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || defaultTab || 'overview';

  const onTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-4 flex flex-wrap w-full bg-transparent p-0 justify-start space-x-2 border-b border-[var(--st-border)] rounded-none">
        <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--st-text)] rounded-none bg-transparent shadow-none px-4 py-2">Overview</TabsTrigger>
        <TabsTrigger value="pricing" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--st-text)] rounded-none bg-transparent shadow-none px-4 py-2">Pricing</TabsTrigger>
        <TabsTrigger value="inventory" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--st-text)] rounded-none bg-transparent shadow-none px-4 py-2">Inventory</TabsTrigger>
        <TabsTrigger value="accounting" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--st-text)] rounded-none bg-transparent shadow-none px-4 py-2">Accounting</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
