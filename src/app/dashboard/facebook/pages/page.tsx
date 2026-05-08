'use client';

import { Newspaper } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Connected Pages"
      description="Manage connected Facebook Pages locally, track ownership, connection status, and setup tasks even when the live Meta connector is unavailable."
      eyebrow="Meta Suite"
      icon={Newspaper}
      accent="#1877F2"
      storageKey="dashboard-facebook-pages"
      primaryActionLabel="Add page connection"
    />
  );
}
