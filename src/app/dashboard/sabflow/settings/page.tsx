'use client';

import { Settings } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="SabFlow Settings"
      description="Configure workspace-level flow settings, notifications, approval rules, and reporting toggles."
      eyebrow="SabFlow"
      icon={Settings}
      accent="#475569"
      storageKey="dashboard-sabflow-settings"
      primaryActionLabel="Add setting"
    />
  );
}
