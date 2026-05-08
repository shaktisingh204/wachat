'use client';

import { PanelsTopLeft } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Stories"
      description="Manage Telegram stories with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={PanelsTopLeft}
      accent="#229ED9"
      storageKey="dashboard-telegram-stories"
      primaryActionLabel="Add stories item"
    />
  );
}
