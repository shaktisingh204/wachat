'use client';

import { Instagram } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Instagram Setup"
      description="Prepare Instagram connection steps, ownership, review status, and manual setup notes without blocking on missing environment variables."
      eyebrow="Instagram"
      icon={Instagram}
      accent="#DB2777"
      storageKey="dashboard-instagram-setup"
      primaryActionLabel="Add setup step"
    />
  );
}
