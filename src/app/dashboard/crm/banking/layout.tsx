
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Landmark, Banknote, User, GitCompareArrows } from 'lucide-react';

const bankingNavItems = [
    { href: "/dashboard/crm/banking/all", label: "All Payment Accounts", icon: Landmark },
    { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts", icon: Banknote },
    { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts", icon: User },
    { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation", icon: GitCompareArrows },
];

export default function BankingLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Bank & Payments</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                         <nav className="flex flex-col gap-1">
                            {bankingNavItems.map(item => (
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
