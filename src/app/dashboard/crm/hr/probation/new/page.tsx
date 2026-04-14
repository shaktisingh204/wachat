'use client';

import { ShieldCheck } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveProbation } from '@/app/actions/hr.actions';

export default function NewProbationPage() {
  return (
    <HrFormPage
      title="New Probation"
      subtitle="Start a probation period for an employee."
      icon={ShieldCheck}
      backHref="/dashboard/crm/hr/probation"
      singular="Probation"
      fields={fields}
      sections={sections}
      saveAction={saveProbation}
    />
  );
}
