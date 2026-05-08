'use client';

import { Users } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Contacts"
      description="Manage Telegram contacts with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Users}
      accent="#229ED9"
      storageKey="dashboard-telegram-contacts"
      primaryActionLabel="Add contacts item"
    />
  );
}
