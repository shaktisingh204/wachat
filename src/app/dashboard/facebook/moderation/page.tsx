'use client';

import { ShieldCheck } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Moderation"
      description="Track moderation queues, rules, flagged keywords, and approval workflows for comments and visitor posts."
      eyebrow="Meta Suite"
      icon={ShieldCheck}
      accent="#DC2626"
      storageKey="dashboard-facebook-moderation"
      primaryActionLabel="Add moderation rule"
    />
  );
}
