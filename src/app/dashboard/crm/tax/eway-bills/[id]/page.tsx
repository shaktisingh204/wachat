import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  ZoruBadge,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import {
  EntityDetailShell,
  type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getEWayBill } from '@/app/actions/crm-india-eway.actions';
import { QrCodeRenderer } from '@/components/wabasimplify/qr-code-renderer';

import { EWayBillRowActions } from '../_components/row-actions';
import { ValidityCountdown } from '../_components/validity-countdown';
import { EWayPrintButton } from '../_components/eway-print-button';

export const dynamic = 'force-dynamic';

function fmtDateTime(v?: string | Date | null): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusTone(s: string): EntityStatusTone {
  if (s === 'cancelled') return 'red';
  if (s === 'expired') return 'amber';
  return 'green';
}

function inr(n: unknown): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `₹${num.toLocaleString('en-IN')}`;
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div
        className={
          mono
            ? 'mt-1 font-mono text-[12.5px] break-all text-zoru-ink'
            : 'mt-1 text-[13px] text-zoru-ink'
        }
      >
        {children}
      </div>
    </div>
  );
}

export default async function EWayBillDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id) notFound();

  const bill = (await getEWayBill(id)) as
    | (Record<string, any> & {
        ewbNo: string;
        status: 'active' | 'cancelled' | 'expired';
        validUpto: string;
        history?: Array<{
          at: string;
          kind: string;
          reason?: string;
          details?: Record<string, unknown>;
        }>;
        items?: Array<{
          description?: string;
          hsn?: string;
          quantity?: number;
          unit?: string;
          taxableValue?: number;
          cgst?: number;
          sgst?: number;
          igst?: number;
        }>;
        documents?: Array<{ name?: string; url?: string }>;
      })
    | null;

  if (!bill) notFound();

  const status = bill.status;
  const title = `E-way bill · ${bill.ewbNo}`;
  const validUpto = String(bill.validUpto ?? '');
  const items = Array.isArray(bill.items) ? bill.items : [];
  const documents = Array.isArray(bill.documents) ? bill.documents : [];
  const history = Array.isArray(bill.history) ? bill.history : [];

  const qrPayload = JSON.stringify({
    ewbNo: bill.ewbNo,
    ewbDate: bill.ewbDate,
    fromGstin: bill.fromGstin,
    toGstin: bill.toGstin ?? null,
    totalValue: bill.totalValue,
  });

  return (
    <EntityDetailShell
      eyebrow="E-WAY BILL"
      title={title}
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/tax/eway-bills', label: 'E-way bills' }}
      actions={
        <>
          <EWayPrintButton />
          <EWayBillRowActions id={id} status={status} />
        </>
      }
      audit={<EntityAuditTimeline entityKind="eway_bill" entityId={id} />}
      rightRail={
        <>
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Validity</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <ValidityCountdown validUpto={validUpto} status={status} />
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Status</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Bill</span>
                  <ZoruBadge variant="outline">{status}</ZoruBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">Provider</span>
                  <span className="font-mono text-zoru-ink">
                    {bill.provider ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zoru-ink-muted">GST portal sync</span>
                  <ZoruBadge variant="outline">
                    {bill.rawResponse ? 'synced' : 'pending'}
                  </ZoruBadge>
                </div>
                <div className="flex items-center justify-between border-t border-zoru-line pt-1.5">
                  <span className="text-zoru-ink-muted">Generated at</span>
                  <span className="text-zoru-ink">
                    {fmtDateTime(bill.ewbDate)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>QR</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex justify-center">
                <QrCodeRenderer value={qrPayload} size={160} />
              </div>
              <p className="mt-2 text-center text-[11px] text-zoru-ink-muted">
                Scan to verify EWB {bill.ewbNo}
              </p>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                {bill.linkedInvoiceId ? (
                  <Link
                    href={`/dashboard/crm/sales/invoices/${bill.linkedInvoiceId}`}
                    className="text-zoru-primary hover:underline"
                  >
                    Linked invoice →
                  </Link>
                ) : (
                  <span className="text-zoru-ink-muted">No linked invoice</span>
                )}
                <Link
                  href="/dashboard/crm/tax/eway-bills"
                  className="text-zoru-primary hover:underline"
                >
                  All e-way bills →
                </Link>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </>
      }
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="EWB No" mono>
              {bill.ewbNo}
            </Field>
            <Field label="EWB date">{fmtDateTime(bill.ewbDate)}</Field>
            <Field label="Valid till">{fmtDateTime(bill.validUpto)}</Field>
            <Field label="Total value">{inr(bill.totalValue)}</Field>
            <Field label="From GSTIN" mono>
              {bill.fromGstin ?? '—'}
            </Field>
            <Field label="To GSTIN" mono>
              {bill.toGstin ?? 'URP'}
            </Field>
            <Field label="From → To pincode">
              {`${bill.fromPincode ?? '—'} → ${bill.toPincode ?? '—'}`}
            </Field>
            <Field label="From → To state">
              {`${bill.fromStateCode ?? '—'} → ${bill.toStateCode ?? '—'}`}
            </Field>
            <Field label="Distance (km)">{String(bill.distanceKm ?? '—')}</Field>
            <Field label="Transaction type">
              {String(bill.transactionType ?? '—')}
            </Field>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Transport</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Vehicle" mono>
              {bill.vehicleNumber ?? '—'}
            </Field>
            <Field label="Transporter" mono>
              {bill.transporterId ?? '—'}
            </Field>
            {bill.cancelReason ? (
              <Field label="Cancel reason">{bill.cancelReason}</Field>
            ) : null}
            {bill.cancelledAt ? (
              <Field label="Cancelled at">{fmtDateTime(bill.cancelledAt)}</Field>
            ) : null}
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Items</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {items.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No line items recorded on this bill. Items are typically sourced
              from the linked invoice.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="border-b border-zoru-line text-left text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">HSN</th>
                    <th className="py-2 pr-3 text-right font-medium">Qty</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Taxable
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">CGST</th>
                    <th className="py-2 pr-3 text-right font-medium">SGST</th>
                    <th className="py-2 text-right font-medium">IGST</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-zoru-line/60">
                      <td className="py-2 pr-3 text-zoru-ink">
                        {it.description ?? '—'}
                      </td>
                      <td className="py-2 pr-3 font-mono text-zoru-ink">
                        {it.hsn ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-zoru-ink">
                        {it.quantity ?? '—'} {it.unit ?? ''}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-zoru-ink">
                        {inr(it.taxableValue)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-zoru-ink">
                        {inr(it.cgst)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-zoru-ink">
                        {inr(it.sgst)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-zoru-ink">
                        {inr(it.igst)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Documents</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            {bill.linkedInvoiceId ? (
              <li>
                <Link
                  href={`/dashboard/crm/sales/invoices/${bill.linkedInvoiceId}`}
                  className="text-zoru-primary hover:underline"
                >
                  Source invoice → {String(bill.linkedInvoiceId)}
                </Link>
              </li>
            ) : null}
            {documents.length === 0 ? (
              <li className="text-zoru-ink-muted">
                No supporting documents attached. Add via SabFiles on the linked
                invoice.
              </li>
            ) : (
              documents.map((d, i) => (
                <li key={i}>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zoru-primary hover:underline"
                    >
                      {d.name ?? d.url}
                    </a>
                  ) : (
                    <span className="text-zoru-ink">{d.name ?? '—'}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>History</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {history.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">No history.</p>
          ) : (
            <ol className="flex flex-col gap-2 text-[12px]">
              {history.map((h, i) => (
                <li
                  key={i}
                  className="rounded-md border border-zoru-line bg-zoru-surface p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zoru-ink">{h.kind}</span>
                    <span className="text-zoru-ink-muted">
                      {fmtDateTime(h.at)}
                    </span>
                  </div>
                  {h.reason ? (
                    <p className="mt-1 text-zoru-ink-muted">{h.reason}</p>
                  ) : null}
                  {h.details ? (
                    <pre className="mt-1 whitespace-pre-wrap text-[10px] text-zoru-ink-muted">
                      {JSON.stringify(h.details, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </EntityDetailShell>
  );
}
