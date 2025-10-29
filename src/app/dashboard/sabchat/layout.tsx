
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart, Handshake, ShoppingBag, Briefcase, Database, ChevronDown, FileText, Landmark, Users as UsersIcon, MessageSquare, Wrench, Settings, BarChart2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const navItems = [
    { href: "/dashboard/sabchat/inbox", label: "Inbox", icon: MessageSquare },
    { href: "/dashboard/sabchat/visitors", label: "Visitors", icon: UsersIcon },
    { href: "/dashboard/sabchat/analytics", label: "Analytics", icon: BarChart },
    { href: "/dashboard/sabchat/widget", label: "Widget Setup", icon: Wrench },
    { href: "/dashboard/sabchat/settings", label: "Settings", icon: Settings },
];

export default function SabChatLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="w-full">
            <div className="flex justify-start items-center gap-1 border-b">
                {navItems.map(item => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Button key={item.href} asChild variant={isActive ? "secondary" : "ghost"} className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Link>
                        </Button>
                    )
                })}
            </div>
            <div className="mt-6">
                 {children}
            </div>
        </div>
    );
}
