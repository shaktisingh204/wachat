'use client';

import { Award } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
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

/** Derive expiry status from the expiresAt date. */
function expiryStatus(row: any): 'active' | 'expiring-soon' | 'expired' | 'no-expiry' {
  if (row.doesNotExpire === 'yes') return 'no-expiry';
  if (!row.expiresAt) return 'no-expiry';
  const now = Date.now();
  const expiry = new Date(row.expiresAt).getTime();
  if (isNaN(expiry)) return 'no-expiry';
  if (expiry < now) return 'expired';
  // warn within 60 days
  if (expiry - now < 60 * 24 * 60 * 60 * 1000) return 'expiring-soon';
  return 'active';
}

const EXPIRY_TONES: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  active: 'green',
  'expiring-soon': 'amber',
  expired: 'red',
  'no-expiry': 'neutral',
};

const EXPIRY_LABELS: Record<string, string> = {
  active: 'Active',
  'expiring-soon': 'Expiring Soon',
  expired: 'Expired',
  'no-expiry': 'No Expiry',
};

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
        {
          key: 'name',
          label: 'Certification',
          render: (row) => (
            <span className="block max-w-[200px] truncate font-medium">
              {(row as any).name || '—'}
            </span>
          ),
        },
        {
          key: 'employeeId',
          label: 'Employee',
          render: (row) => (
            <span className="block max-w-[120px] truncate">
              {row.employeeId ? String(row.employeeId) : '—'}
            </span>
          ),
        },
        {
          key: 'issuer',
          label: 'Issuing Org',
          render: (row) =>
            (row as any).issuer || (row as any).issuingOrganization || '—',
        },
        {
          key: 'issuedAt',
          label: 'Issued',
          render: (row) => <span>{formatDate((row as any).issuedAt)}</span>,
        },
        {
          key: 'expiresAt',
          label: 'Expires',
          render: (row) => <span>{formatDate((row as any).expiresAt)}</span>,
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const s = expiryStatus(row);
            return (
              <ClayBadge tone={EXPIRY_TONES[s]} dot>
                {EXPIRY_LABELS[s]}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={fields}
    />
  );
}
