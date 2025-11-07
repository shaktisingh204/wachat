
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GitFork, Settings, Zap } from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';

const navItems = [
    { href: '/dashboard/sabflow/flow-builder', label: 'Flow Builder', icon: GitFork },
    { href: '/dashboard/sabflow/connections', label: 'App Connections', icon: Zap },
    { href: '/dashboard/sabflow/settings', label: 'Settings', icon: Settings },
];

export default function SabFlowLayout({ children }: { children: React.ReactNode }) {
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
