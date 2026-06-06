'use client';

/**
 * Certifications — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Total · Valid · Expiring 90d · Expired.
 * Server actions preserved: getCertifications / deleteCertification.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Award } from 'lucide-react';

import {
  getCertifications,
  deleteCertification,
} from '@/app/actions/hr.actions';
import type { HrCertification } from '@/lib/hr-types';

import {
  HrChip,
  HrDateCell,
  HrListShell,
} from '../_components/hr-list-shell';
import { StatusPill } from '@/components/crm/status-pill';

type Row = HrCertification & {
  _id: string;
  employeeId: string;
  category?: string;
  doesNotExpire?: string;
  credentialUrl?: string;
};

const MS_90D = 90 * 24 * 60 * 60 * 1000;

function classifyExpiry(row: Row, now: number) {
  if (String(row.doesNotExpire) === 'yes') return 'valid';
  if (!row.expiresAt) return 'unknown';
  const exp = new Date(row.expiresAt).getTime();
  if (Number.isNaN(exp)) return 'unknown';
  if (exp < now) return 'expired';
  if (exp - now < MS_90D) return 'expiring';
  return 'valid';
}

export default function CertificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getCertifications()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const now = Date.now();
  const kpis = React.useMemo(() => {
    let valid = 0;
    let expiring = 0;
    let expired = 0;
    for (const r of rows) {
      const c = classifyExpiry(r, now);
      if (c === 'valid') valid += 1;
      else if (c === 'expiring') expiring += 1;
      else if (c === 'expired') expired += 1;
    }
    return [
      { label: 'Total', value: rows.length },
      { label: 'Valid', value: valid, tone: 'green' as const },
      {
        label: 'Expiring 90d',
        value: expiring,
        tone: 'amber' as const,
        hint: 'Renewals due soon',
      },
      { label: 'Expired', value: expired, tone: 'red' as const },
    ];
  }, [rows, now]);

  return (
    <HrListShell<Row>
      title="Certifications"
      subtitle="Employee credentials, licenses, and renewal tracking."
      icon={Award}
      newHref="/dashboard/hrm/hr/certifications/new"
      editHref={(r) => `/dashboard/hrm/hr/certifications/${r._id}/edit`}
      detailHref={(r) => `/dashboard/hrm/hr/certifications/${r._id}`}
      rows={rows}
      loading={isLoading}
      kpis={kpis}
      searchPlaceholder="Search certifications…"
      searchPredicate={(r, q) =>
        String(r.name ?? '').toLowerCase().includes(q) ||
        String(r.issuer ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteCertification}
      onAfterChange={refresh}
      emptyText="No certifications yet"
      columns={[
        {
          key: 'name',
          label: 'Certification',
          render: (r) => (
            <span className="block max-w-[220px] truncate font-medium">{r.name}</span>
          ),
        },
        { key: 'issuer', label: 'Issuer', render: (r) => r.issuer ?? '—' },
        {
          key: 'category',
          label: 'Category',
          render: (r) => (r.category ? <HrChip>{r.category}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>),
        },
        { key: 'issuedAt', label: 'Issued', render: (r) => <HrDateCell value={r.issuedAt} /> },
        { key: 'expiresAt', label: 'Expires', render: (r) => <HrDateCell value={r.expiresAt} /> },
        {
          key: 'file',
          label: 'File',
          render: (r) =>
            r.credentialUrl ? (
              <a
                href={r.credentialUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--st-text)] underline-offset-2 hover:underline"
              >
                View
              </a>
            ) : (
              <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => {
            const c = classifyExpiry(r, now);
            if (c === 'valid') return <StatusPill label="Valid" tone="green" />;
            if (c === 'expiring') return <StatusPill label="Expiring" tone="amber" />;
            if (c === 'expired') return <StatusPill label="Expired" tone="red" />;
            return <StatusPill label="Unknown" tone="neutral" />;
          },
        },
      ]}
    />
  );
}
