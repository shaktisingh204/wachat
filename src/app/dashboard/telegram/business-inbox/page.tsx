'use client';

import { Inbox } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Business Inbox"
      description="Manage Telegram business inbox with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Inbox}
      accent="#229ED9"
      storageKey="dashboard-telegram-business-inbox"
      primaryActionLabel="Add business inbox item"
    />
  );
}
