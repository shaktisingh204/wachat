'use client';

import * as React from 'react';
import { use } from 'react';

import { HrDetailPage } from '../../_components/hr-detail-page';
import {
  getCertifications,
  deleteCertification,
} from '@/app/actions/hr.actions';
import type { HrCertification } from '@/lib/hr-types';
import { ZoruSkeleton } from '@/components/zoruui';

type Row = HrCertification & {
  _id: string;
  category?: string;
  skillLevel?: string;
  credentialUrl?: string;
  attachmentUrl?: string;
  doesNotExpire?: string;
  issuingOrganization?: string;
  notes?: string;
};

export default function CertificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [row, setRow] = React.useState<Row | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getCertifications()) as Row[];
        if (!active) return;
        setRow(list.find((r) => String(r._id) === id) ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4">
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!row) return <div className="text-sm text-zoru-ink-muted">Certification not found.</div>;

  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
  const now = Date.now();
  const isExpired = expiresAt ? expiresAt.getTime() < now : false;
  const statusLabel =
    String(row.doesNotExpire) === 'yes'
      ? 'No expiry'
      : isExpired
        ? 'Expired'
        : expiresAt
          ? 'Valid'
          : 'Unknown';
  const statusTone: 'green' | 'red' | 'neutral' =
    statusLabel === 'Valid'
      ? 'green'
      : statusLabel === 'Expired'
        ? 'red'
        : 'neutral';

  return (
    <HrDetailPage
      title={row.name || 'Certification'}
      eyebrow="CERTIFICATION"
      status={{ label: statusLabel, tone: statusTone }}
      listHref="/dashboard/hrm/hr/certifications"
      listLabel="Back to certifications"
      editHref={`/dashboard/hrm/hr/certifications/${id}/edit`}
      deleteAction={deleteCertification}
      entityId={id}
      sections={[
        {
          title: 'Certificate',
          fields: [
            { label: 'Issuer', value: row.issuer ?? row.issuingOrganization },
            { label: 'Credential ID', value: row.credentialId },
            { label: 'Category', value: row.category },
            { label: 'Skill level', value: row.skillLevel },
            {
              label: 'Issued',
              value: row.issuedAt ? new Date(row.issuedAt).toLocaleDateString() : null,
            },
            {
              label: 'Expires',
              value: expiresAt ? expiresAt.toLocaleDateString() : null,
            },
          ],
        },
        {
          title: 'Attachments',
          fields: [
            {
              label: 'Credential URL',
              value: row.credentialUrl ? (
                <a
                  href={row.credentialUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-zoru-ink underline-offset-2 hover:underline"
                >
                  {row.credentialUrl}
                </a>
              ) : null,
              fullWidth: true,
            },
            {
              label: 'Attachment',
              value: row.attachmentUrl ? (
                <a
                  href={row.attachmentUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-zoru-ink underline-offset-2 hover:underline"
                >
                  {row.attachmentUrl}
                </a>
              ) : null,
              fullWidth: true,
            },
            { label: 'Notes', value: row.notes, fullWidth: true },
          ],
        },
      ]}
    />
  );
}
