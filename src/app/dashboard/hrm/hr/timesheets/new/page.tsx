'use client';

import { Clock } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveTimesheet } from '@/app/actions/hr.actions';

export default function NewTimesheetPage() {
  return (
    <HrFormPage
      title="New Timesheet"
      subtitle="Log hours worked for the week."
      icon={Clock}
      backHref="/dashboard/hrm/hr/timesheets"
      singular="Timesheet"
      fields={fields}
      sections={sections}
      saveAction={saveTimesheet}
    />
  );
}
