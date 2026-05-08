'use client';

import { Inbox } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Facebook Leads"
      description="Capture, qualify, assign, and export Facebook lead records while the live forms connector is offline."
      eyebrow="Meta Suite"
      icon={Inbox}
      accent="#2563EB"
      storageKey="dashboard-facebook-leads"
      primaryActionLabel="Add lead"
    />
  );
}
