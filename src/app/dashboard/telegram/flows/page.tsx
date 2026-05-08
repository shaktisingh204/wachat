'use client';

import { Workflow } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Flows"
      description="Manage Telegram flows with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Workflow}
      accent="#229ED9"
      storageKey="dashboard-telegram-flows"
      primaryActionLabel="Add flows item"
    />
  );
}
