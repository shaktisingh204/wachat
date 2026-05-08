'use client';

import { Settings } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Settings"
      description="Manage Telegram settings with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Settings}
      accent="#229ED9"
      storageKey="dashboard-telegram-settings"
      primaryActionLabel="Add settings item"
    />
  );
}
