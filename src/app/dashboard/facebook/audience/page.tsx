'use client';

import { Users } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Audience Segments"
      description="Build and maintain reusable audience segments for campaigns, replies, and remarketing journeys."
      eyebrow="Meta Suite"
      icon={Users}
      accent="#7C3AED"
      storageKey="dashboard-facebook-audience"
      primaryActionLabel="Create segment"
    />
  );
}
