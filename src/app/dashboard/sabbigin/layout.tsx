'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/20ui-domain/feature-lock';

/**
 * SabBigin (pipeline CRM) layout.
 *
 * Plan-gating: every SabBigin route is wrapped with `<FeatureLock>` keyed on
 * `sessionUser.plan.features.sabbigin` — the canonical plan feature flag
 * (`PlanFeaturePermissions.sabbigin`, registered in `src/lib/plans.ts` and
 * defaulting to `true`). Per-tier limits (pipelines / forms / booking pages)
 * are enforced at create-time, not by this gate; workflows are uncapped.
 */
export default function SabbiginLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const features = sessionUser?.plan?.features as Record<string, boolean> | undefined;
    // Default-on: SabBigin is available on every plan unless explicitly disabled.
    const isAllowed = features?.sabbigin !== false;
    return (
        <div className="w-full relative">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="SabBigin (lite CRM)" />
            <FeatureLock isAllowed={isAllowed}>{children}</FeatureLock>
        </div>
    );
}
