import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';

/**
 * Petty Cash detail — `/dashboard/crm/petty-cash/[id]`.
 *
 * Per §1D.2: 8 actions, body cards (Overview · Current balance ·
 * Vouchers · Top-up history), right rail w/ balance chip, custodian,
 * branch, days since reconcile.
 */

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';

import { PettyCashDetailActions } from '../_components/petty-cash-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

type PettyCashDoc = {
  _id: string;
  name?: string;
  branchName?: string;
  branchId?: string;
  custodianName?: string;
  custodianId?: string;
  openingBalance?: number;
  currentBalance?: number;
  balance?: number;
  currency?: string;
  status?: string;
  notes?: string;
  totalTopUps?: number;
  totalSpent?: number;
  lastReconciledAt?: string;
  lastReconcileNotes?: string;
  lastReconcileVariance?: number;
  vouchers?: Array<{
    _id?: string;
    category?: string;
    amount?: number;
    payee?: string;
    date?: string;
  }>;
  topUps?: Array<{
    _id?: string;
    amount?: number;
    notes?: string;
    postedAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

function statusTone(status?: string): EntityStatusTone {
  switch (status) {
    case 'active':
      return 'green';
    case 'closed':
      return 'red';
    default:
      return 'neutral';
  }
}

function fmtMoney(value: unknown, currency?: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? 'INR'} ${value}`;
  }
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function daysSince(value?: string): string {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{value ?? '—'}</div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PettyCashDetailPage({ params }: PageProps) {
  const { id } = await params;
  const float = (await getPettyCashFloatById(id)) as PettyCashDoc | null;
  if (!float) notFound();

  const status = float.status ?? 'active';
  const currentBalance = float.balance ?? float.currentBalance ?? 0;
  const vouchers = float.vouchers ?? [];
  const topUps = float.topUps ?? [];

  return (
    <EntityDetailShell
      title={float.name || float.custodianName || 'Petty Cash Float'}
      eyebrow="PETTY CASH"
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/petty-cash', label: 'All floats' }}
      actions={<PettyCashDetailActions floatId={id} />}
      audit={<EntityAuditTimeline entityKind="petty_cash" entityId={id} />}
      rightRail={
        <>
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Balance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Current</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {fmtMoney(currentBalance, float.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Opening</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(float.openingBalance, float.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Total top-ups</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(float.totalTopUps, float.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Total spent</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(float.totalSpent, float.currency)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Custodian</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="text-[12.5px] text-zoru-ink">
                {float.custodianName || '—'}
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Branch</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="text-[12.5px] text-zoru-ink">
                {float.branchName || '—'}
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Reconcile</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Last</span>
                  <span>{daysSince(float.lastReconciledAt)}</span>
                </div>
                {typeof float.lastReconcileVariance === 'number' ? (
                  <div className="flex justify-between">
                    <span className="text-zoru-ink-muted">Variance</span>
                    <span
                      className={`font-mono tabular-nums ${float.lastReconcileVariance !== 0 ? 'text-zoru-danger-ink' : ''}`}
                    >
                      {fmtMoney(float.lastReconcileVariance, float.currency)}
                    </span>
                  </div>
                ) : null}
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <Link
                  href={`/dashboard/crm/petty-cash/${id}/vouchers`}
                  className="text-zoru-primary hover:underline"
                >
                  All vouchers →
                </Link>
              </div>
            </ZoruCardContent>
          </Card>
        </>
      }
    >
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Float name" value={float.name || '—'} />
            <Field label="Branch" value={float.branchName || '—'} />
            <Field label="Custodian" value={float.custodianName || '—'} />
            <Field label="Currency" value={float.currency || 'INR'} />
            <Field
              label="Opening balance"
              value={fmtMoney(float.openingBalance, float.currency)}
            />
            <Field
              label="Current balance"
              value={fmtMoney(currentBalance, float.currency)}
            />
            <Field
              label="Status"
              value={<Badge variant="outline">{status}</Badge>}
            />
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Recent vouchers</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {vouchers.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No vouchers recorded yet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                  <th className="py-2">Date</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Payee</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {vouchers
                  .slice()
                  .reverse()
                  .slice(0, 50)
                  .map((v, idx) => (
                    <tr
                      key={v._id ?? `${v.date}-${idx}`}
                      className="border-b border-zoru-line/40 last:border-0"
                    >
                      <td className="py-2">{fmtDate(v.date)}</td>
                      <td className="py-2">
                        <Badge variant="outline">
                          {(v.category || 'misc').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-2">{v.payee || '—'}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {fmtMoney(v.amount, float.currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Top-up history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {topUps.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No top-ups yet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line/60 text-left text-[11px] uppercase text-zoru-ink-muted">
                  <th className="py-2">Posted at</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {topUps
                  .slice()
                  .reverse()
                  .slice(0, 50)
                  .map((t, idx) => (
                    <tr
                      key={t._id ?? `${t.postedAt}-${idx}`}
                      className="border-b border-zoru-line/40 last:border-0"
                    >
                      <td className="py-2">{fmtDate(t.postedAt)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {fmtMoney(t.amount, float.currency)}
                      </td>
                      <td className="py-2 text-zoru-ink-muted">
                        {t.notes || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </ZoruCardContent>
      </Card>

      {float.notes ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {float.notes}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
