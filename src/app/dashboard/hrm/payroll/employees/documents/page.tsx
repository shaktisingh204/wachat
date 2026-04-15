'use client';

import { FileText } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getEmployeeDocuments,
  saveEmployeeDocument,
  deleteEmployeeDocument,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsEmployeeDocument } from '@/lib/worksuite/hr-ext-types';

export default function EmployeeDocumentsPage() {
  return (
    <HrEntityPage<WsEmployeeDocument & { _id: string }>
      title="Employee Documents"
      subtitle="Upload and track employee documents with expiry dates."
      icon={FileText}
      singular="Document"
      getAllAction={getEmployeeDocuments as any}
      saveAction={saveEmployeeDocument}
      deleteAction={deleteEmployeeDocument}
      columns={[
        { key: 'user_id', label: 'Employee' },
        { key: 'name', label: 'Document' },
        { key: 'file', label: 'File' },
        {
          key: 'uploaded_at',
          label: 'Uploaded',
          render: (r) => (r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : '—'),
        },
        {
          key: 'expiry_date',
          label: 'Expires',
          render: (r) => (r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'),
        },
      ]}
      fields={[
        { name: 'user_id', label: 'Employee ID', required: true },
        { name: 'name', label: 'Document Name', required: true, fullWidth: true },
        { name: 'file', label: 'File URL', type: 'url', fullWidth: true },
        { name: 'uploaded_at', label: 'Uploaded At', type: 'date' },
        { name: 'expiry_date', label: 'Expiry Date', type: 'date' },
      ]}
    />
  );
}
