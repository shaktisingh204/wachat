'use client';

import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { ErrorBoundary } from './error-boundary';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.crmInventory ?? false;
    return (
        <div className="w-full relative">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="CRM Inventory" />
            <FeatureLock isAllowed={isAllowed}>
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </FeatureLock>
        </div>
    );
}
