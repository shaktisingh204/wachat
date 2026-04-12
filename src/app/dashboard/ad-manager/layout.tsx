'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { AdManagerShell } from '@/components/wabasimplify/ad-manager/ad-manager-shell';

export default function AdManagerLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.whatsappAds ?? false;

    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="Ad Manager" />
            <FeatureLock isAllowed={isAllowed}>
                <AdManagerShell>
                    {children}
                </AdManagerShell>
            </FeatureLock>
        </div>
    );
}
