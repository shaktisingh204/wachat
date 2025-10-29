
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCog } from 'lucide-react';

const teamNavItems = [
    { href: "/dashboard/crm/team/manage-users", label: "Manage Users", icon: Users },
    { href: "/dashboard/crm/team/manage-roles", label: "Manage Team Roles", icon: UserCog },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Team Management</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                         <nav className="flex flex-col gap-1">
                            {teamNavItems.map(item => (
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
