'use client';

import { CalendarDays } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Events"
      description="Plan, track, and report on Facebook events with owners, status, reminders, and exportable rows."
      eyebrow="Meta Suite"
      icon={CalendarDays}
      accent="#059669"
      storageKey="dashboard-facebook-events"
      primaryActionLabel="Create event"
    />
  );
}
