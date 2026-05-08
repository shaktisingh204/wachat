'use client';

import { BookOpen } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Knowledge Base"
      description="Manage documents, FAQs, and answer sources for agents and automation flows."
      eyebrow="Meta Suite"
      icon={BookOpen}
      accent="#4F46E5"
      storageKey="dashboard-facebook-knowledge"
      primaryActionLabel="Add document"
    />
  );
}
