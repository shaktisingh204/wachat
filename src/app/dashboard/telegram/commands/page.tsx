'use client';

import { TerminalSquare } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Telegram Commands"
      description="Manage Telegram commands with local records, filters, settings, and CSV export while the live Telegram connector is prepared."
      eyebrow="Telegram"
      icon={TerminalSquare}
      accent="#229ED9"
      storageKey="dashboard-telegram-commands"
      primaryActionLabel="Add commands item"
    />
  );
}
