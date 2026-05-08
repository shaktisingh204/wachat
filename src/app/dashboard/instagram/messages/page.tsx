'use client';

import { MessageCircle } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Instagram Messages"
      description="Track Instagram conversations, saved replies, owners, and response workflows."
      eyebrow="Instagram"
      icon={MessageCircle}
      accent="#7C3AED"
      storageKey="dashboard-instagram-messages"
      primaryActionLabel="Add message workflow"
    />
  );
}
