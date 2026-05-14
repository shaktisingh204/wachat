'use client';

import { Target } from 'lucide-react';
import { HrFormPage } from '../../../hr/_components/hr-form-page';
import { saveCrmGoal } from '@/app/actions/crm-hr.actions';
import { fields, sections } from '../_config';

export default function NewGoalPage() {
  return (
    <HrFormPage
      title="New goal"
      subtitle="Set a measurable goal with a clear target date and progress tracker."
      icon={Target}
      backHref="/dashboard/hrm/payroll/goal-setting"
      singular="Goal"
      fields={fields}
      sections={sections}
      saveAction={saveCrmGoal}
    />
  );
}
