
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Handshake, ShoppingBag, Briefcase, Database, Landmark, Users as UsersIcon, FileText, Settings, Zap, MessageSquare } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const CrmSidebar = () => {
    const pathname = usePathname();

    const crmNavItems = [
        { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
        { href: "/dashboard/crm/sales-crm", label: "Sales", icon: Handshake },
        { href: "/dashboard/crm/purchases", label: "Purchases", icon: ShoppingBag },
        { href: "/dashboard/crm/inventory", label: "Inventory", icon: Briefcase },
        { href: "/dashboard/crm/accounting", label: "Accounting", icon: Database },
        { href: "/dashboard/crm/banking", label: "Bank & Payments", icon: Landmark },
        { href: "/dashboard/crm/team", label: "Manage Team", icon: UsersIcon },
        { href: "/dashboard/crm/reports/gstr-1", label: "GST Reports", icon: FileText },
        { href: "/dashboard/crm/integrations", label: "Integrations", icon: Zap },
        { href: "/dashboard/crm/hr-payroll", label: "HR and Payroll", icon: UsersIcon },
        { href: "/dashboard/crm/auto-leads-setup", label: "Auto Leads Setup", icon: Zap },
    ];

    return (
        <Card>
            <CardHeader className="p-4">
                <CardTitle className="text-lg">CRM Suite</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-2">
                <nav className="flex flex-col gap-1">
                    {crmNavItems.map(item => {
                        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${isActive ? 'bg-muted text-primary' : ''}`}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
            </CardContent>
        </Card>
    );
}


export default function CrmLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid md:grid-cols-[240px_1fr] gap-8 h-full">
            <aside className="hidden md:block">
                <CrmSidebar />
            </aside>
            <main className="min-h-0">
                {children}
            </main>
        </div>
    );
}
