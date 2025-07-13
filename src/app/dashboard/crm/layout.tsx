
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Handshake, Users, FolderKan, BarChart, Settings } from 'lucide-react';

const crmNavItems = [
    { href: '/dashboard/crm', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/crm/contacts', label: 'Leads & Contacts', icon: Users },
    { href: '/dashboard/crm/deals', label: 'Deals', icon: Handshake },
    { href: '/dashboard/crm/tasks', label: 'Tasks', icon: FolderKan },
    { href: '/dashboard/crm/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/crm/settings', label: 'Settings', icon: Settings },
];


export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-8">
            <div className="border-b">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {crmNavItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
                                pathname === item.href ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            )}
                        >
                           <item.icon className="inline-block mr-2 h-4 w-4" />
                           {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <div>
                {children}
            </div>
        </div>
    );
}
