
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, Box, Users, Repeat, FilePlus, Package, History, BarChart, CalendarClock, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Inventory</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                         <nav className="flex flex-col gap-1">
                            {inventoryNavItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${pathname === item.href ? 'bg-muted text-primary' : ''}`}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </CardContent>
                </Card>
            </div>
            <main className="md:col-span-9 lg:col-span-10">
                {children}
            </main>
        </div>
    );
}
