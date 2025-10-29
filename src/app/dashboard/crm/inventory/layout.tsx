
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Box, Users, Repeat, FilePlus, Package, History, BarChart, CalendarClock, IndianRupee } from "lucide-react";

const inventoryNavItems = [
    { href: "/dashboard/crm/inventory/items", label: "All Items", icon: Package },
    { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses", icon: Box },
    { href: "/dashboard/crm/inventory/adjustments", label: "Adjustments", icon: Repeat },
    { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions", icon: History },
    { href: "/dashboard/crm/inventory/pnl", label: "Product P&L", icon: BarChart },
    { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report", icon: IndianRupee },
    { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report", icon: CalendarClock },
    { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions", icon: Users },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <Tabs defaultValue={pathname} className="w-full">
                <TabsList>
                    {inventoryNavItems.map(item => (
                         <TabsTrigger key={item.href} value={item.href} asChild>
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4"/>
                                {item.label}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div className="mt-4">
                 {children}
            </div>
        </div>
    );
}
