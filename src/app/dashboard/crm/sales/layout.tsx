
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

// This secondary layout is no longer needed as navigation is handled by the main CRM layout.
export default function SalesLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.crmSales ?? false;

    return (
        <div className="w-full relative">
             <FeatureLockOverlay isAllowed={isAllowed} featureName="CRM Sales" />
             <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
