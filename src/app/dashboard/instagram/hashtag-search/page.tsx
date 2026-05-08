'use client';

import { Hash } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Hashtag Search"
      description="Build hashtag sets, rank opportunities, track owners, and export research lists."
      eyebrow="Instagram"
      icon={Hash}
      accent="#0891B2"
      storageKey="dashboard-instagram-hashtag-search"
      primaryActionLabel="Add hashtag"
    />
  );
}
