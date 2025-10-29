
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Users, Briefcase, BarChart2 } from 'lucide-react';

const salesCrmNavItems = [
    { href: "/dashboard/crm/sales-crm/all-leads", label: "All Leads", icon: Users },
    { href: "/dashboard/crm/sales-crm/pipelines", label: "Pipelines", icon: Briefcase },
    { href: "/dashboard/crm/sales-crm/forms", label: "Forms", icon: FileText },
    { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary", icon: BarChart2 },
    { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report", icon: BarChart2 },
    { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance", icon: BarChart2 },
    { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report", icon: BarChart2 },
];


export default function SalesCrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Sales CRM</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                         <nav className="flex flex-col gap-1">
                            {salesCrmNavItems.map(item => (
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
