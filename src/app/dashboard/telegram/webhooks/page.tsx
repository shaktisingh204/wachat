'use client';

import { Webhook } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Webhooks"
      description="Manage Telegram webhooks with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Webhook}
      accent="#229ED9"
      storageKey="dashboard-telegram-webhooks"
      primaryActionLabel="Add webhooks item"
    />
  );
}
