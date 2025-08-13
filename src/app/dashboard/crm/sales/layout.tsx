
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, Handshake, TrendingUp, BadgeInfo, CreditCard } from "lucide-react";

const salesNavItems = [
    { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects", icon: Users },
    { href: "/dashboard/crm/sales/quotations", label: "Quotations & Estimates", icon: FileText },
    { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: FileText },
    { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: CreditCard },
    { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices", icon: BadgeInfo },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6 h-full">
            <Tabs value={pathname} className="w-full">
                <TabsList>
                    {salesNavItems.map(item => (
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
