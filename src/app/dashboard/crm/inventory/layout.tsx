
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Box, Users, Repeat, FilePlus } from "lucide-react";

const inventoryNavItems = [
    { href: "/dashboard/crm/inventory", label: "Dashboard", icon: Truck },
    { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses", icon: Box },
    { href: "/dashboard/crm/inventory/vendors", label: "Vendors", icon: Users },
    { href: "/dashboard/crm/inventory/adjustments", label: "Adjustments", icon: Repeat },
    { href: "/dashboard/crm/inventory/purchase-orders", label: "Purchase Orders", icon: FilePlus },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Inventory Management</h1>
                <p className="text-muted-foreground">Manage your stock levels, warehouses, and suppliers.</p>
            </div>
            <Tabs value={pathname} className="w-full">
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
