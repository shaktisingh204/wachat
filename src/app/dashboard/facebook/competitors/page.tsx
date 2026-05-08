'use client';

import { Radar } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Competitors"
      description="Track competitor pages, content ideas, engagement snapshots, and review tasks."
      eyebrow="Meta Suite"
      icon={Radar}
      accent="#EA580C"
      storageKey="dashboard-facebook-competitors"
      primaryActionLabel="Track competitor"
    />
  );
}
