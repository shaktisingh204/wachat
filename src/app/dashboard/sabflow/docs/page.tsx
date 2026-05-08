'use client';

import { BookCopy } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="SabFlow Documentation"
      description="Maintain internal workflow docs, setup notes, and runbook records in a searchable workspace."
      eyebrow="SabFlow"
      icon={BookCopy}
      accent="#4F46E5"
      storageKey="dashboard-sabflow-docs"
      primaryActionLabel="Add doc"
    />
  );
}
