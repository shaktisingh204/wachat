'use client';

import { Award } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getCertifications,
  saveCertification,
  deleteCertification,
} from '@/app/actions/hr.actions';
import type { HrCertification } from '@/lib/hr-types';
import { fields } from './_config';

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default function CertificationsPage() {
  return (
    <HrEntityPage<HrCertification & { _id: string }>
      title="Certifications"
      subtitle="Employee credentials, licenses, and professional certifications."
      icon={Award}
      singular="Certification"
      basePath="/dashboard/hrm/hr/certifications"
      getAllAction={getCertifications as any}
      saveAction={saveCertification}
      deleteAction={deleteCertification}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'issuer', label: 'Issuer' },
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
          key: 'issuedAt',
          label: 'Issued',
          render: (row) => <span>{formatDate(row.issuedAt)}</span>,
        },
        {
          key: 'expiresAt',
          label: 'Expires',
          render: (row) => <span>{formatDate(row.expiresAt)}</span>,
        },
      ]}
      fields={fields}
    />
  );
}
