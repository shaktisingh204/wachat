'use client';

import { BarChart3 } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Analytics"
      description="Manage Telegram analytics with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={BarChart3}
      accent="#229ED9"
      storageKey="dashboard-telegram-analytics"
      primaryActionLabel="Add analytics item"
    />
  );
}
