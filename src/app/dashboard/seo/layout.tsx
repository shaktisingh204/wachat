import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { ChartBar, Radio, Globe, Layers } from 'lucide-react';
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
import { seoMenuItems } from '@/config/dashboard-config';

export default function SeoLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const pathname = usePathname();
    const isAllowed = sessionUser?.plan?.features?.seo ?? false;

    // "Hide these before selecting seo project"
    // We assume selecting a project takes you to /dashboard/seo/[projectId] or a sub-tool.
    // So if pathname is exactly /dashboard/seo, we hide the sidebar.
    const showSidebar = pathname !== '/dashboard/seo';

    if (!showSidebar) {
        return (
            <div className="relative h-full">
                <FeatureLockOverlay isAllowed={isAllowed} featureName="SEO Suite" />
                <FeatureLock isAllowed={isAllowed}>
                    {children}
                </FeatureLock>
            </div>
        )
    }

    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="SEO Suite" />
            <FeatureLock isAllowed={isAllowed}>
                <ModuleLayout
                    sidebar={
                        <ModuleSidebar
                            title="SEO Suite"
                            items={seoMenuItems}
                        />
                    }
                >
                    {children}
                </ModuleLayout>
            </FeatureLock>
        </div>
    );
}
