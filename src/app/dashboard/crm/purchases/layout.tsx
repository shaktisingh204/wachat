
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crmMenuItems } from '@/app/dashboard/crm/layout';

const purchasesNavItems = crmMenuItems.find(item => item.label === 'Purchases')?.subItems || [];

export default function PurchasesLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const activeTab = purchasesNavItems.find(item => pathname.startsWith(item.href))?.href || "/dashboard/crm/purchases/vendors";

    return (
        <div className="flex flex-col gap-6 h-full p-4 md:p-6 lg:p-8">
            <Tabs defaultValue={activeTab} className="w-full">
                <TabsList className="overflow-x-auto whitespace-nowrap">
                    {purchasesNavItems.map(item => (
                         <TabsTrigger key={item.href} value={item.href} asChild>
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4"/>
                                {item.label}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div className="mt-4 flex-1">
                 {children}
            </div>
        </div>
    );
}
