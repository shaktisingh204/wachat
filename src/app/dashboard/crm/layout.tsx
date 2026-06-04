'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/zoruui-domain/feature-lock';
import { getMyEffectivePlanFeatures } from '@/app/actions/rbac.actions';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser, activeProjectId } = useProject();

    // Plan features must be resolved for the active TENANT: a team member
    // inherits the OWNER's plan, not their own personal plan (which would
    // wrongly show the "Premium Feature" upsell). Start optimistic so legit
    // users don't see the lock flash while the check resolves.
    const [isAllowed, setIsAllowed] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const features = await getMyEffectivePlanFeatures(activeProjectId);
                if (!cancelled) setIsAllowed(Boolean(features?.crmDashboard));
            } catch {
                if (!cancelled) {
                    setIsAllowed(Boolean(sessionUser?.plan?.features?.crmDashboard));
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeProjectId, sessionUser]);

    return (
        <div className="w-full h-full relative">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="CRM Suite" />
            <FeatureLock isAllowed={isAllowed}>
                {children}
            </FeatureLock>
        </div>
    );
}
