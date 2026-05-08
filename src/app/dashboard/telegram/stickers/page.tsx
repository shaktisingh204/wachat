'use client';

import { Sticker } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Stickers"
      description="Manage Telegram stickers with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={Sticker}
      accent="#229ED9"
      storageKey="dashboard-telegram-stickers"
      primaryActionLabel="Add stickers item"
    />
  );
}
