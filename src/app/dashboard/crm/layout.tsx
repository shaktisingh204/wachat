'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Handshake, Users, FolderKanban, BarChart2, Settings, Building, Mail, Zap, MessageSquare, ShoppingBag, Truck, Repeat, Video, Calendar, Package, TrendingUp, Rss, Globe, PhoneCall } from 'lucide-react';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isAutomationPage = pathname.startsWith('/dashboard/crm/automations');

    if (isAutomationPage) {
        return <div className="h-full w-full">{children}</div>;
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            {children}
        </div>
    );
}
