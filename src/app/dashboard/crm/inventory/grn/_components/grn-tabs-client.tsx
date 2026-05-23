'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface GrnTabsClientProps {
    defaultTab?: string;
    itemsContent: React.ReactNode;
    attachmentsContent: React.ReactNode;
    notesContent: React.ReactNode;
    vehicleContent: React.ReactNode;
}

export function GrnTabsClient({
    defaultTab = 'items',
    itemsContent,
    attachmentsContent,
    notesContent,
    vehicleContent,
}: GrnTabsClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentTab = searchParams.get('tab') || defaultTab;

    const onValueChange = (val: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', val);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <Tabs value={currentTab} onValueChange={onValueChange} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b border-zoru-line bg-transparent p-0">
                <TabsTrigger 
                    value="items" 
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-zoru-ink-muted shadow-none transition-none data-[state=active]:border-zoru-primary data-[state=active]:text-zoru-ink data-[state=active]:shadow-none"
                >
                    Line Items
                </TabsTrigger>
                {vehicleContent && (
                    <TabsTrigger 
                        value="vehicle" 
                        className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-zoru-ink-muted shadow-none transition-none data-[state=active]:border-zoru-primary data-[state=active]:text-zoru-ink data-[state=active]:shadow-none"
                    >
                        Vehicle & Transport
                    </TabsTrigger>
                )}
                {attachmentsContent && (
                    <TabsTrigger 
                        value="attachments" 
                        className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-zoru-ink-muted shadow-none transition-none data-[state=active]:border-zoru-primary data-[state=active]:text-zoru-ink data-[state=active]:shadow-none"
                    >
                        Attachments
                    </TabsTrigger>
                )}
                {notesContent && (
                    <TabsTrigger 
                        value="notes" 
                        className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-zoru-ink-muted shadow-none transition-none data-[state=active]:border-zoru-primary data-[state=active]:text-zoru-ink data-[state=active]:shadow-none"
                    >
                        Notes
                    </TabsTrigger>
                )}
            </TabsList>
            
            <TabsContent value="items" className="mt-4 border-none p-0 outline-none">
                {itemsContent}
            </TabsContent>
            
            {vehicleContent && (
                <TabsContent value="vehicle" className="mt-4 border-none p-0 outline-none">
                    {vehicleContent}
                </TabsContent>
            )}
            
            {attachmentsContent && (
                <TabsContent value="attachments" className="mt-4 border-none p-0 outline-none">
                    {attachmentsContent}
                </TabsContent>
            )}
            
            {notesContent && (
                <TabsContent value="notes" className="mt-4 border-none p-0 outline-none">
                    {notesContent}
                </TabsContent>
            )}
        </Tabs>
    );
}
