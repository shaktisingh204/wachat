'use client';

import { Clapperboard } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Instagram Reels"
      description="Plan reel ideas, production status, owners, and publish-readiness in a working content tracker."
      eyebrow="Instagram"
      icon={Clapperboard}
      accent="#DB2777"
      storageKey="dashboard-instagram-reels"
      primaryActionLabel="Add reel"
    />
  );
}
