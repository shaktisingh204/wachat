
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
    { href: '/dashboard/seo', label: 'Dashboard' },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar' },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer' },
];

export default function SeoLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.seo ?? false;
    const pathname = usePathname();

    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="SEO Suite" />
            <FeatureLock isAllowed={isAllowed}>
                <div className="space-y-6">
                    <Tabs value={pathname}>
                        <TabsList>
                            {navItems.map(item => (
                                <TabsTrigger key={item.href} value={item.href} asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
