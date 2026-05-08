'use client';

import { BarChart3 } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Facebook Insights"
      description="Review local KPI snapshots, compare content performance, and export insight rows with safe fallback metrics."
      eyebrow="Meta Suite"
      icon={BarChart3}
      accent="#1877F2"
      storageKey="dashboard-facebook-insights"
      primaryActionLabel="Add insight snapshot"
    />
  );
}
