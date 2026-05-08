'use client';

import { Radio } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Channels"
      description="Manage Telegram channels with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Radio}
      accent="#229ED9"
      storageKey="dashboard-telegram-channels"
      primaryActionLabel="Add channels item"
    />
  );
}
