'use client';

import { AppWindow } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Mini Apps"
      description="Manage Telegram mini apps with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={AppWindow}
      accent="#229ED9"
      storageKey="dashboard-telegram-mini-apps"
      primaryActionLabel="Add mini apps item"
    />
  );
}
