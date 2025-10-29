
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FileText, CreditCard, ShoppingBag, Bot, Repeat } from 'lucide-react';

const salesNavItems = [
    { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects", icon: Users },
    { href: "/dashboard/crm/sales/quotations", label: "Quotations", icon: FileText },
    { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices", icon: FileText },
    { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: FileText },
    { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: CreditCard },
    { href: "/dashboard/crm/sales/orders", label: "Sales Orders", icon: ShoppingBag },
    { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans", icon: Bot },
    { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes", icon: Repeat },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Sales</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                         <nav className="flex flex-col gap-1">
                            {salesNavItems.map(item => (
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
