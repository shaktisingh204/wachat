'use client';

import { Clock } from 'lucide-react';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { ShiftForm } from '../_components/shift-form';

export default function NewShiftPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Shift"
        subtitle="Create a shift with timings, break rules and open days."
        icon={Clock}
      />
      <ShiftForm />
    </div>
  );
}
