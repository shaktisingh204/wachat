
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, MessageSquare, Send, Users, BarChart, Settings } from "lucide-react";

const navItems = [
    { href: "/dashboard/sms", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/sms/campaigns", label: "Campaigns", icon: Send },
    { href: "/dashboard/sms/contacts", label: "Contacts", icon: Users },
    { href: "/dashboard/sms/analytics", label: "Analytics", icon: BarChart },
    { href: "/dashboard/sms/settings", label: "Settings", icon: Settings },
];

export default function SmsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <MessageSquare className="h-8 w-8" />
                    SMS Suite
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage your SMS campaigns and provider integrations.
                </p>
            </div>
            <Tabs defaultValue={pathname} className="w-full">
                <TabsList>
                    {navItems.map(item => (
                         <TabsTrigger key={item.href} value={item.href} asChild>
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4"/>
                                {item.label}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div className="mt-4">
                 {children}
            </div>
        </div>
    );
}
