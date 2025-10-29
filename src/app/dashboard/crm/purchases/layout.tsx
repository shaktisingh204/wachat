
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, CreditCard, FileText, Repeat, Star, Users } from 'lucide-react';

const purchasesNavItems = [
    { href: "/dashboard/crm/purchases/leads", label: "Vendor Leads", icon: Users },
    { href: "/dashboard/crm/purchases/vendors", label: "Vendors", icon: Briefcase },
    { href: "/dashboard/crm/purchases/expenses", label: "Expenses", icon: CreditCard },
    { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders", icon: FileText },
    { href: "/dashboard/crm/purchases/payouts", label: "Payouts", icon: CreditCard },
    { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes", icon: Repeat },
    { href: "/dashboard/crm/purchases/hire", label: "Hire Vendors", icon: Star },
];

export default function PurchasesLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Purchases</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        <nav className="flex flex-col gap-1">
                            {purchasesNavItems.map(item => (
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
