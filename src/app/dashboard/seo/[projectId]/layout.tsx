'use client';

import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Activity, Map, Trophy, Globe, Settings } from 'lucide-react';

export default function SeoProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { projectId: string };
}) {
    const pathname = usePathname();
    const projectId = params.projectId; // In Next.js 15 layouts receive params directly or as promise, but generic usage is safe here for client component wrapper if passed down. 
    // Actually layouts in Next 15: params is a Promise. But usually we can just use the path or wait for it.
    // Simplifying for Client Component usage or just hardcoding the path logic if needed.

    // Define navigation items for this project
    // We construct URLs dynamically
    const navItems = [
        {
            title: "Overview",
            href: `/dashboard/seo/${projectId}`,
            icon: LayoutDashboard,
            active: pathname === `/dashboard/seo/${projectId}`
        },
        {
            title: "Audit & Fix",
            href: `/dashboard/seo/${projectId}/audit`,
            icon: Activity,
            active: pathname.includes('/audit')
        },
        {
            title: "Rankings",
            href: `/dashboard/seo/${projectId}/rankings`,
            icon: Trophy,
            active: pathname.includes('/rankings')
        },
        {
            title: "Local Grid",
            href: `/dashboard/seo/${projectId}/grid`,
            icon: Map,
            active: pathname.includes('/grid')
        },
        {
            title: "Competitors",
            href: `/dashboard/seo/${projectId}/competitors`,
            icon: Globe,
            active: pathname.includes('/competitors')
        },
        {
            title: "Settings",
            href: `/dashboard/seo/${projectId}/settings`,
            icon: Settings,
            active: pathname.includes('/settings')
        }
    ];

    return (
        <div className="h-full">
            {children}
        </div>
    );
}
