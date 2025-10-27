
'use client';

import { FileText, GanttChart, Users, BarChart, Search, Target, LineChart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const salesCrmNavItems = [
    { href: "/dashboard/crm/sales-crm/all-pipelines", label: "All Sales Pipelines", icon: GanttChart },
    { href: "/dashboard/crm/sales-crm/forms", label: "Forms", icon: FileText },
    { href: "/dashboard/crm/sales-crm/all-leads", label: "All Leads", icon: Users },
    { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary", icon: BarChart },
    { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report", icon: Target },
    { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance Report", icon: LineChart },
    { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report", icon: Search },
];

export default function SalesCrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold font-headline">Sales CRM</h1>
                <p className="text-muted-foreground">Tools to manage your leads, pipelines, and sales performance.</p>
            </div>
            <Tabs value={pathname} className="w-full">
                <TabsList className="overflow-x-auto h-auto whitespace-nowrap justify-start">
                    {salesCrmNavItems.map(item => (
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
