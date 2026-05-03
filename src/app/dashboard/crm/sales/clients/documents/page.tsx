'use client';

import { FileText } from 'lucide-react';
import { HrEntityPage } from '../../../_components/hr-entity-page';
import {
  getClientDocuments,
  saveClientDocument,
  deleteClientDocument,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsClientDocument } from '@/lib/worksuite/crm-types';

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function formatBytes(bytes: unknown) {
  const b = Number(bytes);
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ClientDocumentsPage() {
  return (
    <HrEntityPage<WsClientDocument & { _id: string }>
      title="Client Documents"
      subtitle="Uploaded files (contracts, proposals, kyc) per client."
      icon={FileText}
      singular="Document"
      getAllAction={getClientDocuments as any}
      saveAction={saveClientDocument}
      deleteAction={deleteClientDocument}
      columns={[
        { key: 'filename', label: 'Filename' },
        { key: 'client_id', label: 'Client' },
        {
          key: 'size',
          label: 'Size',
          render: (row) => formatBytes(row.size),
        },
        {
          key: 'uploaded_at',
          label: 'Uploaded',
          render: (row) => formatDate(row.uploaded_at),
        },
        {
          key: 'url',
          label: 'Link',
          render: (row) =>
            row.url ? (
              <a
                href={String(row.url)}
                target="_blank"
                rel="noreferrer"
                className="text-accent-foreground underline"
              >
                open
              </a>
            ) : (
              '—'
            ),
        },
      ]}
      fields={[
        {
          name: 'client_id',
          label: 'Client ID',
          required: true,
          placeholder: 'Mongo ObjectId of the account',
          fullWidth: true,
        },
        { name: 'filename', label: 'Filename', required: true, fullWidth: true },
        { name: 'url', label: 'File URL', fullWidth: true },
        { name: 'size', label: 'Size (bytes)', type: 'number' },
        { name: 'uploaded_at', label: 'Uploaded At', type: 'date' },
      ]}
    />
  );
}
