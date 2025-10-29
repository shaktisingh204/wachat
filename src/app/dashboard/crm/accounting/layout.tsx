
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookCopy, FileText, Database, BarChart } from 'lucide-react';

const accountingNavItems = [
    { href: "/dashboard/crm/accounting/groups", label: "Account Groups", icon: BookCopy },
    { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts", icon: Database },
    { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books", icon: FileText },
    { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet", icon: BarChart },
    { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance", icon: BarChart },
    { href: "/dashboard/crm/accounting/pnl", label: "Profit & Loss", icon: BarChart },
    { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement", icon: BarChart },
    { href: "/dashboard/crm/accounting/day-book", label: "Day Book", icon: BookCopy },
    { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement", icon: BarChart },
];


export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Accounting</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                         <nav className="flex flex-col gap-1">
                            {accountingNavItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${pathname.startsWith(item.href) ? 'bg-muted text-primary' : ''}`}
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
