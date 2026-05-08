'use client';

import { Megaphone } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Ads"
      description="Manage Telegram ads with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Megaphone}
      accent="#229ED9"
      storageKey="dashboard-telegram-ads"
      primaryActionLabel="Add ads item"
    />
  );
}
