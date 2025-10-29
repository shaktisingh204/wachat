
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart, Handshake, ShoppingBag, Briefcase, Database, ChevronDown, FileText, Landmark, Users as UsersIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const CrmNavItems = [
    { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
    { href: "/dashboard/crm/sales-crm", label: "Sales", icon: Handshake },
    { href: "/dashboard/crm/purchases", label: "Purchases", icon: ShoppingBag },
    { href: "/dashboard/crm/inventory", label: "Inventory", icon: Briefcase },
    { href: "/dashboard/crm/accounting", label: "Accounting", icon: Database },
];

const ReportsNavItems = [
    { href: "/dashboard/crm/reports/gstr-1", label: "GSTR-1 Sales Report" },
    { href: "/dashboard/crm/reports/gstr-2b", label: "GSTR-2B Purchase Report" },
];

const bankingNavItems = [
    { href: "/dashboard/crm/banking/all", label: "All Payment Accounts" },
    { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts" },
    { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts" },
    { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation" },
];

const teamNavItems = [
    { href: "/dashboard/crm/team/manage-users", label: "Manage Users" },
    { href: "/dashboard/crm/team/manage-roles", label: "Manage Team Roles" },
];

export function CrmTabLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                 <div className="flex items-center gap-1 border-b">
                    {CrmNavItems.map(item => {
                         const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                        return (
                            <Button key={item.href} asChild variant={isActive ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
                                <Link href={item.href}>
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {item.label}
                                </Link>
                            </Button>
                        )
                    })}
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant={pathname.startsWith("/dashboard/crm/banking") ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=open]:border-primary data-[state=open]:text-primary">
                                <Landmark className="mr-2 h-4 w-4" />
                                Bank & Payments <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {bankingNavItems.map(item => (
                                <DropdownMenuItem key={item.href} asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant={pathname.startsWith("/dashboard/crm/team") ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=open]:border-primary data-[state=open]:text-primary">
                                <UsersIcon className="mr-2 h-4 w-4" />
                                Manage Team <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {teamNavItems.map(item => (
                                <DropdownMenuItem key={item.href} asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant={pathname.startsWith("/dashboard/crm/reports") ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=open]:border-primary data-[state=open]:text-primary">
                                GST Reports <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {ReportsNavItems.map(item => (
                                <DropdownMenuItem key={item.href} asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Separator />
            <div>
                 {children}
            </div>
        </div>
    );
}
