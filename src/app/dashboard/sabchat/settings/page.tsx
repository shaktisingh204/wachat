'use client';

import { Settings } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="SabChat Settings"
      description="Configure inbox preferences, business hours, quick automations, notifications, and escalation settings."
      eyebrow="SabChat"
      icon={Settings}
      accent="#0891B2"
      storageKey="dashboard-sabchat-settings"
      primaryActionLabel="Add setting"
    />
  );
}
