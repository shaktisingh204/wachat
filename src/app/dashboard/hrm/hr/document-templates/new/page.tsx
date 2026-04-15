'use client';

import { ClipboardList } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveDocumentTemplate } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewDocumentTemplatePage() {
  return (
    <HrFormPage
      title="New Template"
      subtitle="Create a reusable document template."
      icon={ClipboardList}
      backHref="/dashboard/hrm/hr/document-templates"
      singular="Template"
      fields={fields}
      sections={sections}
      saveAction={saveDocumentTemplate}
    />
  );
}
