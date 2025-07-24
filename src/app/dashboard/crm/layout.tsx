

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Handshake, Users, FolderKanban, BarChart2, Settings, Building, Mail, Zap, MessageSquare, ShoppingBag, Truck } from 'lucide-react';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const crmMenuItems = [
        { href: '/dashboard/crm', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/crm/contacts', label: 'Contacts', icon: Users },
        { href: '/dashboard/crm/accounts', label: 'Accounts', icon: Building },
        { href: '/dashboard/crm/deals', label: 'Deals', icon: Handshake },
        { href: '/dashboard/crm/products', label: 'Products', icon: ShoppingBag },
        { href: '/dashboard/crm/inventory', label: 'Inventory', icon: Truck },
        { href: '/dashboard/crm/tasks', label: 'Tasks', icon: FolderKanban },
        { href: '/dashboard/crm/email', label: 'Email', icon: Mail },
        { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare },
        { href: '/dashboard/crm/analytics', label: 'Analytics', icon: BarChart2 },
        { href: '/dashboard/crm/automations', label: 'Automations', icon: Zap },
        { href: '/dashboard/crm/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="flex flex-col gap-8 h-full">
            {children}
        </div>
    );
}
