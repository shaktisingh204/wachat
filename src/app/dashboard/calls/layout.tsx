
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Settings, Phone } from 'lucide-react';

const navItems = [
    { href: "/dashboard/calls/logs", label: "Call Logs", icon: History },
    { href: "/dashboard/calls/settings", label: "Call Setup", icon: Settings },
];

export default function CallsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Phone className="h-8 w-8"/>
                    WhatsApp Calling
                </h1>
                <p className="text-muted-foreground mt-2">
                    Configure and monitor your WhatsApp calling features.
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
            <div className="mt-2">
                 {children}
            </div>
        </div>
    );
}
