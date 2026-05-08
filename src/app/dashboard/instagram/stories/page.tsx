'use client';

import { PanelsTopLeft } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Instagram Stories"
      description="Organize story campaigns, creative notes, audience targets, and review status."
      eyebrow="Instagram"
      icon={PanelsTopLeft}
      accent="#C026D3"
      storageKey="dashboard-instagram-stories"
      primaryActionLabel="Add story"
    />
  );
}
