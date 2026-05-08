'use client';

import { ScrollText } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="SabFlow Logs"
      description="Search execution logs, create follow-up records, and export flow run history from a working local log console."
      eyebrow="SabFlow"
      icon={ScrollText}
      accent="#2563EB"
      storageKey="dashboard-sabflow-logs"
      primaryActionLabel="Add log note"
    />
  );
}
