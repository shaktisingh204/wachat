'use client';

import { Star } from 'lucide-react';
import { HrFormPage } from '../../../hr/_components/hr-form-page';
import { saveCrmAppraisalReview } from '@/app/actions/crm-hr-appraisals.actions';
import { fields, sections } from '../_config';

export default function NewAppraisalPage() {
  return (
    <HrFormPage
      title="New appraisal review"
      subtitle="Rate, comment, and capture next-cycle goals for an employee."
      icon={Star}
      backHref="/dashboard/hrm/payroll/appraisal-reviews"
      singular="Review"
      fields={fields}
      sections={sections}
      saveAction={saveCrmAppraisalReview}
    />
  );
}
