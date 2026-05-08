'use client';

import { Workflow } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Facebook Flow Builder"
      description="Design Messenger flows, organize drafts, assign owners, and keep automation work inside Meta Suite instead of redirecting to commerce."
      eyebrow="Meta Suite"
      icon={Workflow}
      accent="#1877F2"
      storageKey="dashboard-facebook-flow-builder"
      primaryActionLabel="Create flow"
    />
  );
}
