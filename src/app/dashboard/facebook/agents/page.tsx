'use client';

import { Bot } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Facebook Agents"
      description="Create routing agents, assign owners, and organize escalation workflows for Facebook conversations."
      eyebrow="Meta Suite"
      icon={Bot}
      accent="#1877F2"
      storageKey="dashboard-facebook-agents"
      primaryActionLabel="Create agent"
    />
  );
}
