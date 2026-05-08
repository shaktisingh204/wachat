'use client';

import { Store } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Shop Setup"
      description="Track catalog readiness, setup checks, review status, and commerce launch tasks without depending on a live Meta shop response."
      eyebrow="Meta Commerce"
      icon={Store}
      accent="#0F766E"
      storageKey="dashboard-facebook-commerce-shop"
      primaryActionLabel="Add setup task"
    />
  );
}
