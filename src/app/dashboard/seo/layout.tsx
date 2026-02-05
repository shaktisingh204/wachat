'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { ChartBar, Radio, Globe, Layers } from 'lucide-react';
import { seoMenuItems } from '@/config/dashboard-config';

export default function SeoLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const pathname = usePathname();
    const isAllowed = sessionUser?.plan?.features?.seo ?? false;

    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="SEO Suite" />
            <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
