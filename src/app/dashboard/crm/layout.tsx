
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart, Handshake, ShoppingBag, Briefcase, Database, ChevronDown, FileText, Landmark, Users as UsersIcon, Settings, Zap, Bot } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const CrmNavItems = [
    { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
    { href: "/dashboard/crm/sales-crm/all-leads", label: "Sales", icon: Handshake },
    { href: "/dashboard/crm/purchases/vendors", label: "Purchases", icon: ShoppingBag },
    { href: "/dashboard/crm/inventory", label: "Inventory", icon: Briefcase },
    { href: "/dashboard/crm/accounting", label: "Accounting", icon: Database },
];

const moreNavItems = [
    { href: "/dashboard/crm/banking", label: "Bank & Payments", icon: Landmark },
    { href: "/dashboard/crm/team", label: "Manage Team", icon: UsersIcon },
    { href: "/dashboard/crm/reports/gstr-1", label: "GST Reports", icon: FileText },
    { href: "/dashboard/crm/integrations", label: "Integrations", icon: Zap },
    { href: "/dashboard/crm/hr-payroll", label: "HR and Payroll", icon: UsersIcon },
    { href: "/dashboard/crm/auto-leads-setup", label: "Auto Leads Setup", icon: Bot },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1 border-b">
                    {CrmNavItems.map(item => {
                         const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                        return (
                            <Button key={item.href} asChild variant={isActive ? "secondary" : "ghost"} className="rounded-b-none">
                                <Link href={item.href}>
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {item.label}
                                </Link>
                            </Button>
                        )
                    })}
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant={moreNavItems.some(item => pathname.startsWith(item.href)) ? "secondary" : "ghost"} className="rounded-b-none">
                                More <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {moreNavItems.map(item => (
                                <DropdownMenuItem key={item.href} asChild>
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div>
                 {children}
            </div>
        </div>
    );
}
