'use client';

import React from 'react';

import { FeatureLock, FeatureLockOverlay } from '@/components/20ui-domain/feature-lock';
import { useProject } from '@/context/project-context';

import { SabbiCommandPalette } from './_components/command-palette';

/**
 * SabBI (Business Intelligence) layout — plan gate.
 *
 * Every SabBI route is wrapped with `<FeatureLock>` keyed on
 * `sessionUser.plan.features.sabbi` (registered in `src/lib/plans.ts`,
 * defaults to `true`). SabBI is a general `/dashboard` analytics tool, so it
 * scopes data to the shared active project (`session.user.activeProjectId`)
 * via `runWithSabbiTenant` rather than forcing a kind-specific project
 * selection; this gate only governs plan entitlement.
 */
export default function SabbiLayout({ children }: { children: React.ReactNode }) {
  const { sessionUser } = useProject();
  const features = sessionUser?.plan?.features as Record<string, boolean> | undefined;
  // Default-on: SabBI is available on every plan unless explicitly disabled.
  const isAllowed = features?.sabbi !== false;
  return (
    <div className="w-full relative">
      <FeatureLockOverlay isAllowed={isAllowed} featureName="SabBI (Business Intelligence)" />
      <FeatureLock isAllowed={isAllowed}>{children}</FeatureLock>
      <SabbiCommandPalette />
    </div>
  );
}
