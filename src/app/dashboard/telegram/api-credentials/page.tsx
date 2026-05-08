'use client';

import { KeyRound } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram API Credentials"
      description="Manage Telegram api credentials with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={KeyRound}
      accent="#229ED9"
      storageKey="dashboard-telegram-api-credentials"
      primaryActionLabel="Add api credentials item"
    />
  );
}
