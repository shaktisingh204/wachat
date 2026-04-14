'use client';

import { Heart } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveWelcomeKit } from '@/app/actions/hr.actions';

export default function NewWelcomeKitPage() {
  return (
    <HrFormPage
      title="New Welcome Kit"
      subtitle="Curate a first-day experience for new hires."
      icon={Heart}
      backHref="/dashboard/crm/hr/welcome-kit"
      singular="Kit"
      fields={fields}
      sections={sections}
      saveAction={saveWelcomeKit}
    />
  );
}
