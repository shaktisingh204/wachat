'use client';

import { Send } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Broadcasts"
      description="Manage Telegram broadcasts with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Send}
      accent="#229ED9"
      storageKey="dashboard-telegram-broadcasts"
      primaryActionLabel="Add broadcasts item"
    />
  );
}
