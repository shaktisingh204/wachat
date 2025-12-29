

'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.crmDashboard ?? false; // Using crmDashboard as the master flag for the suite

    return (
        <div className="w-full h-full relative">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="CRM Suite" />
            <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
