'use client';

import { MessagesSquare } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Visitor Posts"
      description="Review visitor-submitted posts, track status, owners, and moderation decisions in one workspace."
      eyebrow="Meta Suite"
      icon={MessagesSquare}
      accent="#0F766E"
      storageKey="dashboard-facebook-visitor-posts"
      primaryActionLabel="Add visitor post"
    />
  );
}
