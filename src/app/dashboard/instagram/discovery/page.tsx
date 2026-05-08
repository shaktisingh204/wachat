'use client';

import { Compass } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Instagram Discovery"
      description="Save discovery targets, creators, inspiration posts, and outreach status in a working research board."
      eyebrow="Instagram"
      icon={Compass}
      accent="#EA580C"
      storageKey="dashboard-instagram-discovery"
      primaryActionLabel="Add discovery target"
    />
  );
}
