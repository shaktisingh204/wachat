
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

export default function SalesCrmLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.crmSalesCrm ?? false;
    return (
        <div className="w-full relative">
             <FeatureLockOverlay isAllowed={isAllowed} featureName="Sales CRM" />
             <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
