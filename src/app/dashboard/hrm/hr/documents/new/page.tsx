'use client';

import { FileText } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveDocument } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewDocumentPage() {
  return (
    <HrFormPage
      title="New Document"
      subtitle="Upload or record an employee document."
      icon={FileText}
      backHref="/dashboard/hrm/hr/documents"
      singular="Document"
      fields={fields}
      sections={sections}
      saveAction={saveDocument}
    />
  );
}
