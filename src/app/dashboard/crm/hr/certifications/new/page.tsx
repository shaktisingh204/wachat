'use client';

import { Award } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveCertification } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewCertificationPage() {
  return (
    <HrFormPage
      title="New Certification"
      subtitle="Record a credential or professional certification."
      icon={Award}
      backHref="/dashboard/crm/hr/certifications"
      singular="Certification"
      fields={fields}
      sections={sections}
      saveAction={saveCertification}
    />
  );
}
