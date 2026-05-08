'use client';

import { Handshake } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Vendor Hire"
      description="Track vendor hiring requests, bids, approvals, and onboarding tasks."
      eyebrow="CRM Purchases"
      icon={Handshake}
      accent="#0F766E"
      storageKey="dashboard-crm-purchases-hire"
      primaryActionLabel="Add hire request"
    />
  );
}
