'use client';

import { ClipboardList } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getDocumentTemplates,
  saveDocumentTemplate,
  deleteDocumentTemplate,
} from '@/app/actions/hr.actions';
import type { HrDocumentTemplate } from '@/lib/hr-types';

export default function DocumentTemplatesPage() {
  return (
    <HrEntityPage<HrDocumentTemplate & { _id: string }>
      title="Document Templates"
      subtitle="Reusable templates for offer letters, NDAs, and more."
      icon={ClipboardList}
      singular="Template"
      getAllAction={getDocumentTemplates as any}
      saveAction={saveDocumentTemplate}
      deleteAction={deleteDocumentTemplate}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        { name: 'category', label: 'Category' },
        {
          name: 'body',
          label: 'Body',
          type: 'textarea',
          required: true,
          fullWidth: true,
        },
        {
          name: 'placeholders',
          label: 'Placeholders (JSON array)',
          type: 'textarea',
          fullWidth: true,
          placeholder: '["{{firstName}}", "{{startDate}}"]',
        },
      ]}
    />
  );
}
