'use client';

import { LineChart } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveCompensationBand } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewCompensationBandPage() {
  return (
    <HrFormPage
      title="New Compensation Band"
      subtitle="Define a salary band for a role level."
      icon={LineChart}
      backHref="/dashboard/hrm/hr/compensation-bands"
      singular="Band"
      fields={fields}
      sections={sections}
      saveAction={saveCompensationBand}
    />
  );
}
