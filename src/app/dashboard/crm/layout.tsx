
'use client';

import React from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crmMenuItems } from '@/components/wabasimplify/dashboard-client-layout';

export default function CrmTabLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const renderNav = () => {
        const topLevelItem = crmMenuItems.find(item => pathname.startsWith(item.href) && item.subItems);
        if (topLevelItem && topLevelItem.subItems) {
            const activeTab = topLevelItem.subItems.find(item => pathname.startsWith(item.href))?.href || topLevelItem.subItems[0]?.href;
            return (
                <Tabs defaultValue={activeTab} className="w-full">
                    <TabsList className="overflow-x-auto whitespace-nowrap">
                        {topLevelItem.subItems.map(item => (
                             <TabsTrigger key={item.href} value={item.href} asChild>
                                <Link href={item.href}>
                                    <item.icon className="mr-2 h-4 w-4"/>
                                    {item.label}
                                </Link>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            );
        }
        return null;
    }

    return (
        <div className="flex flex-col gap-6 h-full p-4 md:p-6 lg:p-8">
            {renderNav()}
            <div className="mt-4 flex-1">
                 {children}
            </div>
        </div>
    );
}
