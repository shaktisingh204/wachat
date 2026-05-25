import { fmtDate } from '@/lib/utils';
import { HrDetailPage } from '../../_components/hr-detail-page';
import {
  getCertification,
  deleteCertification,
} from '@/app/actions/hr.actions';
import type { HrCertification } from '@/lib/hr-types';

export const dynamic = 'force-dynamic';

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

export default async function CertificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = (await getCertification(id)) as Row | null;

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
              value: row.issuedAt ? fmtDate(row.issuedAt) : null,
            },
            {
              label: 'Expires',
              value: expiresAt ? fmtDate(expiresAt) : null,
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
