'use client';

import { FileText } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getDocuments,
  saveDocument,
  deleteDocument,
} from '@/app/actions/hr.actions';
import type { HrDocument } from '@/lib/hr-types';

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default function DocumentsPage() {
  return (
    <HrEntityPage<HrDocument & { _id: string }>
      title="Documents"
      subtitle="Employee documents, IDs, and compliance files."
      icon={FileText}
      singular="Document"
      getAllAction={getDocuments as any}
      saveAction={saveDocument}
      deleteAction={deleteDocument}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">
              {row.employeeId ? String(row.employeeId) : '—'}
            </span>
          ),
        },
        {
          key: 'expiresAt',
          label: 'Expires',
          render: (row) => <span>{formatDate(row.expiresAt)}</span>,
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, fullWidth: true },
        { name: 'category', label: 'Category' },
        { name: 'employeeId', label: 'Employee ID' },
        { name: 'url', label: 'URL' },
        { name: 'expiresAt', label: 'Expires At', type: 'date' },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
