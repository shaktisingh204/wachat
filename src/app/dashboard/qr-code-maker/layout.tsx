
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

export default function QrCodeMakerLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.qrCodeMaker ?? false;
    
    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="QR Code Maker" />
            <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
