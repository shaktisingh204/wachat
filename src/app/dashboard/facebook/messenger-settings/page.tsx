'use client';

import { MessageSquare } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Messenger Settings"
      description="Configure greeting text, saved responses, ice breakers, domains, and review-ready Messenger preferences without hitting unfinished Rust endpoints."
      eyebrow="Meta Suite"
      icon={MessageSquare}
      accent="#1877F2"
      storageKey="dashboard-facebook-messenger-settings"
      primaryActionLabel="Add saved response"
    />
  );
}
