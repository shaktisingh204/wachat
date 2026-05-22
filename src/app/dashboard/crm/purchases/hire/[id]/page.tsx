import { Button, Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Hire request detail — `/dashboard/crm/purchases/hire/[id]`.
 *
 * Server component. Renders the hire (purchase lead) record using the
 * shared `<EntityDetailShell>` so the layout matches the other CRM
 * entity detail pages. Activity footer is wired via `audit` →
 * `<EntityAuditTimeline>` (entityKind = `'hire'`).
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCrmHireById } from '@/app/actions/crm-hire.actions';

export const dynamic = 'force-dynamic';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(v: number | undefined): string {
  if (typeof v !== 'number' || isNaN(v)) return '—';
  return inr.format(v);
}

function formatDate(v: string | Date | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function stageTone(
  stage?: string,
): 'green' | 'amber' | 'red' | 'blue' | 'neutral' {
  switch ((stage || '').toLowerCase()) {
    case 'awarded':
      return 'green';
    case 'negotiating':
    case 'quotes_received':
      return 'amber';
    case 'closed_lost':
      return 'red';
    default:
      return 'neutral';
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function HireDetailPage({ params }: PageProps) {
  const { id } = await params;
  const hire = await getCrmHireById(id);
  if (!hire) notFound();

  const title = hire.title || 'Hire request';
  const stage = (hire.stage as string | undefined) || 'sourcing';

  return (
    <EntityDetailShell
      title={title}
      eyebrow="HIRE REQUEST"
      status={{ label: stage, tone: stageTone(stage) }}
      back={{
        href: '/dashboard/crm/purchases/hire',
        label: 'Back to hire requests',
      }}
      actions={
        <Button asChild>
          <Link href={`/dashboard/crm/purchases/hire/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      }
      audit={<EntityAuditTimeline entityKind="hire" entityId={id} />}
    >
      <Card className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Request details
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title">{hire.title || '—'}</Field>
          <Field label="Category">{hire.category || '—'}</Field>
          <Field label="Vendor candidate">
            {hire.vendorCandidate || '—'}
          </Field>
          <Field label="Owner">{hire.owner || '—'}</Field>
          <Field label="Required by">{formatDate(hire.requiredBy)}</Field>
          <Field label="Quantity">
            {typeof hire.quantity === 'number' ? hire.quantity : '—'}
          </Field>
          <Field label="Estimated budget">
            {formatMoney(hire.estimatedBudget)}
          </Field>
          <Field label="Status">{hire.status || '—'}</Field>
        </div>
        {hire.specs ? (
          <div className="mt-6">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
              Specifications / scope
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
              {hire.specs}
            </p>
          </div>
        ) : null}
      </Card>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {formatDate(hire.createdAt)} · Updated{' '}
        {formatDate(hire.updatedAt)}
      </div>
    </EntityDetailShell>
  );
}
