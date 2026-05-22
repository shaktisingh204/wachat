/**
 * Contract detail — `/dashboard/crm/sales/contracts/[contractId]`
 *
 * Server component. Uses `getContract` from the Wave-2 contracts
 * actions (Rust BFF path with Mongo fallback) and renders with
 * `<EntityDetailShell>` (§1D pattern).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileSignature, Pencil, Plus } from 'lucide-react';

import { Badge, Button, Card } from '@/components/zoruui';
import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getContract } from '@/app/actions/crm/contracts.actions';

export const dynamic = 'force-dynamic';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function capitalize(s?: string | null): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string): EntityStatusTone {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'renewed') return 'green';
  if (s === 'pending_signature') return 'amber';
  if (s === 'terminated' || s === 'expired' || s === 'cancelled') return 'red';
  if (s === 'draft') return 'neutral';
  return 'neutral';
}

function Field({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const { contract, error } = await getContract(contractId);

  if (!contract) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Could not load this contract — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/sales/contracts">
              Back to Contracts
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const status = (contract.status as string) || 'draft';
  const title = contract.title || 'Untitled Contract';

  return (
    <EntityDetailShell
      eyebrow="CONTRACT"
      title={title}
      status={{ label: capitalize(status), tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/sales/contracts', label: 'All contracts' }}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/crm/sales/contracts/${contractId}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/crm/sales/contracts/new">
              <Plus className="h-4 w-4" /> New contract
            </Link>
          </Button>
        </>
      }
    >
      {/* Main details card */}
      <Card className="p-6">
        <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Contract details
        </h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label="Counter-party">{contract.partyName || '—'}</Field>
          <Field label="Party email">{contract.partyEmail || '—'}</Field>
          <Field label="Contract #">{contract.contractNo || '—'}</Field>
          <Field label="Type">{capitalize(contract.type)}</Field>
          <Field label="Signatory">{contract.signatoryName || '—'}</Field>
          <Field label="Signatory email">{contract.signatoryEmail || '—'}</Field>
          <Field label="Effective date">{fmtDate(contract.effectiveDate)}</Field>
          <Field label="Expiry date">{fmtDate(contract.expiryDate)}</Field>
          <Field label="Contract value">
            {fmtMoney(contract.value, contract.currency)}
          </Field>
          <Field label="Currency">{contract.currency || '—'}</Field>
          <Field label="Auto-renew">
            {contract.autoRenew ? 'Yes' : 'No'}
          </Field>
          <Field label="Renewal notice">
            {typeof contract.renewalNoticeDays === 'number'
              ? `${contract.renewalNoticeDays} days`
              : '—'}
          </Field>
          <Field label="E-sign provider">{capitalize(contract.esignProvider)}</Field>
          <Field label="Status">
            <Badge
              variant={
                status === 'active' || status === 'renewed'
                  ? 'success'
                  : status === 'pending_signature'
                    ? 'warning'
                    : status === 'terminated' || status === 'expired'
                      ? 'danger'
                      : 'default'
              }
            >
              {capitalize(status)}
            </Badge>
          </Field>
          {contract.scope ? (
            <Field label="Scope" fullWidth>
              <pre className="whitespace-pre-wrap font-sans text-[12.5px]">
                {contract.scope}
              </pre>
            </Field>
          ) : null}
          {contract.notes ? (
            <Field label="Notes" fullWidth>
              <pre className="whitespace-pre-wrap font-sans text-[12.5px]">
                {contract.notes}
              </pre>
            </Field>
          ) : null}
        </div>
      </Card>

      {/* Attachments */}
      {Array.isArray(contract.attachments) && contract.attachments.length > 0 ? (
        <Card className="p-6">
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Attachments
          </h3>
          <ul className="flex flex-col gap-1.5">
            {contract.attachments.map((url, i) => (
              <li key={url} className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                >
                  Attachment {i + 1}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Meta footer */}
      <p className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(contract.createdAt)} · Updated {fmtDate(contract.updatedAt)}
      </p>
    </EntityDetailShell>
  );
}
