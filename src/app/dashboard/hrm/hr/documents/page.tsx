'use client';

import { FileText } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getDocuments,
  saveDocument,
  deleteDocument,
} from '@/app/actions/hr.actions';
import type { HrDocument } from '@/lib/hr-types';
import { fields } from './_config';

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
      basePath="/dashboard/hrm/hr/documents"
      getAllAction={getDocuments as any}
      saveAction={saveDocument}
      deleteAction={deleteDocument}
      columns={[
        { key: 'name', label: 'Document Name' },
        {
          key: 'category',
          label: 'Category',
          render: (row) =>
            row.category ? (
              <ClayBadge tone="neutral">{row.category}</ClayBadge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[160px] truncate">
              {row.employeeId ? String(row.employeeId) : '—'}
            </span>
          ),
        },
        { key: 'documentNumber', label: 'Document #' },
        {
          key: 'issuedDate',
          label: 'Issued',
          render: (row) => <span>{formatDate((row as any).issuedDate)}</span>,
        },
        {
          key: 'expiresAt',
          label: 'Expires',
          render: (row) => <span>{formatDate(row.expiresAt)}</span>,
        },
        {
          key: 'isConfidential',
          label: 'Confidential',
          render: (row) => {
            const yes =
              row.isConfidential === true ||
              (row.isConfidential as unknown as string) === 'yes';
            return (
              <ClayBadge tone={yes ? 'amber' : 'neutral'}>
                {yes ? 'Yes' : 'No'}
              </ClayBadge>
            );
          },
        },
        {
          key: 'url',
          label: 'File',
          render: (row) =>
            row.url ? (
              <a
                href={String(row.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-accent-foreground underline-offset-2 hover:underline"
              >
                View
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]}
      fields={fields}
    />
  );
}
