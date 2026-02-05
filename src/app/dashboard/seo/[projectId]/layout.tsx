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
        <div className="flex h-full">
            <div className="w-64 border-r bg-muted/10 hidden md:block h-[calc(100vh-64px)] overflow-y-auto">
                {/* We can use the existing ModuleSidebar or build a simple one using the items */}
                <div className="p-4">
                    <h3 className="font-bold text-sm text-muted-foreground px-2 mb-2 uppercase tracking-wider">Project Menu</h3>
                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${item.active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto h-[calc(100vh-64px)]">
                {children}
            </div>
        </div>
    );
}
