'use client';

import { Cable } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="SabFlow Connections"
      description="Manage connector records, ownership, status, and sync preferences for workflow integrations."
      eyebrow="SabFlow"
      icon={Cable}
      accent="#0F766E"
      storageKey="dashboard-sabflow-connections"
      primaryActionLabel="Add connection"
    />
  );
}
