'use client';

import { SlidersHorizontal } from 'lucide-react';
import { WorkingFeaturePage } from '@/components/dashboard/working-feature-page';

export default function Page() {
  return (
    <WorkingFeaturePage
      title="Payroll Settings"
      description="Configure pay cycle, attendance, leave policy, tax deductions, and notification preferences from one working payroll settings workspace."
      eyebrow="HRM Payroll"
      icon={SlidersHorizontal}
      accent="#475569"
      storageKey="dashboard-hrm-payroll-settings"
      primaryActionLabel="Add payroll rule"
    />
  );
}
