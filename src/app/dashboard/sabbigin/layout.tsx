'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';

/**
 * SabBigin (lite CRM SKU) layout.
 *
 * Plan-gating: every SabBigin route is wrapped with `<FeatureLock>` keyed on
 * `sessionUser.plan.features.crmSabbigin`. Until `crmSabbigin` is added to
 * `src/lib/plans.json` and provisioned on the SabBigin plan tier, this flag
 * resolves to `false` and the overlay is shown.
 *
 * TODO (plans.json): add a `crmSabbigin` boolean feature to the plan schema
 * and turn it on for the SabBigin SKU. Coordinate with the billing team — do
 * not edit `plans.json` from inside this module.
 */
export default function SabbiginLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const features = sessionUser?.plan?.features as Record<string, boolean> | undefined;
    const isAllowed = Boolean(features?.crmSabbigin);
    return (
        <div className="w-full relative">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="SabBigin (lite CRM)" />
            <FeatureLock isAllowed={isAllowed}>{children}</FeatureLock>
        </div>
    );
}
