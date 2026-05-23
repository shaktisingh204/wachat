'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function StockTransferDetailTabs({
  children,
}: {
  children: Record<string, React.ReactNode>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="items">Line Items</TabsTrigger>
        <TabsTrigger value="notes">Notes & Attachments</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        {children['overview']}
      </TabsContent>
      <TabsContent value="items" className="space-y-4">
        {children['items']}
      </TabsContent>
      <TabsContent value="notes" className="space-y-4">
        {children['notes']}
      </TabsContent>
    </Tabs>
  );
}
