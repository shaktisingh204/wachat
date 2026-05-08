'use client';

import { MessageCircle } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Chat"
      description="Manage Telegram chat with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={MessageCircle}
      accent="#229ED9"
      storageKey="dashboard-telegram-chat"
      primaryActionLabel="Add chat item"
    />
  );
}
