
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

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

    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="SEO Suite" />
            <FeatureLock isAllowed={isAllowed}>
                <ModuleLayout
                    sidebar={
                        <ModuleSidebar
                            title="SEO Suite"
                            items={[
                                { href: '/dashboard/seo', label: 'Dashboard', icon: ChartBar },
                                { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Radio },
                                { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe },
                            ]}
                        />
                    }
                >
                    {children}
                </ModuleLayout>
            </FeatureLock>
        </div>
    );
}

import { ChartBar, Radio, Globe } from 'lucide-react';
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
