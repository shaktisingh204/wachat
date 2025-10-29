
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users as UsersIcon, BarChart, Wrench, Settings, Bot, HelpCircle, LifeBuoy } from 'lucide-react';
import { SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

const navItems = [
    { href: "/dashboard/sabchat/inbox", label: "Inbox", icon: MessageSquare },
    { href: "/dashboard/sabchat/visitors", label: "Visitors", icon: UsersIcon },
    { href: "/dashboard/sabchat/analytics", label: "Analytics", icon: BarChart },
    { href: "/dashboard/sabchat/widget", label: "Widget Setup", icon: Wrench },
    { href: "/dashboard/sabchat/auto-reply", label: "Auto Reply", icon: Bot },
    { href: "/dashboard/sabchat/quick-replies", label: "Quick Replies", icon: LifeBuoy },
    { href: "/dashboard/sabchat/ai-replies", label: "AI Replies", icon: Bot },
    { href: "/dashboard/sabchat/faq", label: "FAQ", icon: HelpCircle },
    { href: "/dashboard/sabchat/settings", label: "Settings", icon: Settings },
];

export default function SabChatLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="w-full">
             <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <SabChatIcon className="h-8 w-8 text-primary"/>
                        sabChat
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Your live chat and customer support suite.
                    </p>
                </div>
            </div>
            <div className="flex justify-start items-center gap-1 border-b">
                {navItems.map(item => {
                    const isActive = pathname === item.href;
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
