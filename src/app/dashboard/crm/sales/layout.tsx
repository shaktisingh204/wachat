
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, ShoppingBag, Truck, Repeat, BadgeInfo, CreditCard } from "lucide-react";

const salesNavItems = [
    { href: "/dashboard/crm/sales/clients", label: "Clients", icon: Users },
    { href: "/dashboard/crm/sales/quotations", label: "Quotations", icon: FileText },
    { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: FileText },
    { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: CreditCard },
    { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices", icon: BadgeInfo },
    { href: "/dashboard/crm/sales/orders", label: "Sales Orders", icon: ShoppingBag },
    { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans", icon: Truck, disabled: true },
    { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes", icon: Repeat, disabled: true },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const activeTab = navItems.find(item => pathname.startsWith(item.href))?.href || "/dashboard/crm/sales/clients";

    return (
        <div className="flex flex-col gap-6 h-full">
            <Tabs defaultValue={activeTab} className="w-full">
                <TabsList className="overflow-x-auto whitespace-nowrap">
                    {salesNavItems.map(item => (
                         <TabsTrigger key={item.href} value={item.href} asChild disabled={item.disabled}>
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
