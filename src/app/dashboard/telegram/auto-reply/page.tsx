'use client';

import { Bot } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Auto Reply"
      description="Manage Telegram auto reply with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Bot}
      accent="#229ED9"
      storageKey="dashboard-telegram-auto-reply"
      primaryActionLabel="Add auto reply item"
    />
  );
}
