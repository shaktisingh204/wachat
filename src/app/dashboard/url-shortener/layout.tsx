
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import Link from 'next/link';

export default function UrlShortenerLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.urlShortener ?? false;
    
    return (
        <div className="relative h-full">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="URL Shortener" />
            <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
