'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/20ui-domain/feature-lock';

export default function QrCodeMakerLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.qrCodeMaker ?? false;

    return (
        <div className="relative h-full flex flex-col">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="QR Code Maker" />
            <FeatureLock isAllowed={isAllowed}>
                <div className="flex-1 min-h-0">
                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
