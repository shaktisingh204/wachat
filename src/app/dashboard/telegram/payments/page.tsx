'use client';

import { CreditCard } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Payments"
      description="Manage Telegram payments with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={CreditCard}
      accent="#229ED9"
      storageKey="dashboard-telegram-payments"
      primaryActionLabel="Add payments item"
    />
  );
}
