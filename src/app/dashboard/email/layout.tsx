
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { Mail } from 'lucide-react';

export default function EmailLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.email ?? false;

    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="Email Suite" />
            <FeatureLock isAllowed={isAllowed}>
                <div className="flex flex-col gap-6 h-full">

                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
