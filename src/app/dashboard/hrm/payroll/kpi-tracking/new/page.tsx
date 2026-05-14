'use client';

import { LineChart } from 'lucide-react';
import { HrFormPage } from '../../../hr/_components/hr-form-page';
import { saveCrmKpi } from '@/app/actions/crm-hr-appraisals.actions';
import { fields, sections } from '../_config';

export default function NewKpiPage() {
  return (
    <HrFormPage
      title="New KPI"
      subtitle="Define a measurable indicator with target and tracking period."
      icon={LineChart}
      backHref="/dashboard/hrm/payroll/kpi-tracking"
      singular="KPI"
      fields={fields}
      sections={sections}
      saveAction={saveCrmKpi}
    />
  );
}
