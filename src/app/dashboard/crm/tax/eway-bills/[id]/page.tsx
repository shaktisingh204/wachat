import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import {
  EntityDetailShell,
  type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getEWayBill } from '@/app/actions/crm-india-eway.actions';
import { QrCodeRenderer } from '@/components/zoruui-domain/qr-code-renderer';

import { EWayBillRowActions } from '../_components/row-actions';
import { ValidityCountdown } from '../_components/validity-countdown';
import { EWayPrintButton } from '../_components/eway-print-button';

export const dynamic = 'force-dynamic';

function fmtDateTime(v?: string | Date | null): string {
  if (!v) return '—';
  const date = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div
        className={
          mono
            ? 'mt-1 font-mono text-[12.5px] break-all text-[var(--st-text)]'
            : 'mt-1 text-[13px] text-[var(--st-text)]'
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
          <Card>
            <CardHeader>
              <CardTitle>Validity</CardTitle>
            </CardHeader>
            <CardBody>
              <ValidityCountdown validUpto={validUpto} status={status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Bill</span>
                  <Badge variant="outline">{status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Provider</span>
                  <span className="font-mono text-[var(--st-text)]">
                    {bill.provider ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">GST portal sync</span>
                  <Badge variant="outline">
                    {bill.rawResponse ? 'synced' : 'pending'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-1.5">
                  <span className="text-[var(--st-text-secondary)]">Generated at</span>
                  <span className="text-[var(--st-text)]">
                    {fmtDateTime(bill.ewbDate)}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex justify-center">
                <QrCodeRenderer value={qrPayload} size={160} />
              </div>
              <p className="mt-2 text-center text-[11px] text-[var(--st-text-secondary)]">
                Scan to verify EWB {bill.ewbNo}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-2 text-[12.5px]">
                {bill.linkedInvoiceId ? (
                  <Link
                    href={`/dashboard/crm/sales/invoices/${bill.linkedInvoiceId}`}
                    className="text-[var(--st-text)] hover:underline"
                  >
                    Linked invoice →
                  </Link>
                ) : (
                  <span className="text-[var(--st-text-secondary)]">No linked invoice</span>
                )}
                <Link
                  href="/dashboard/crm/tax/eway-bills"
                  className="text-[var(--st-text)] hover:underline"
                >
                  All e-way bills →
                </Link>
              </div>
            </CardBody>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transport</CardTitle>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No line items recorded on this bill. Items are typically sourced
              from the linked invoice.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="border-b border-[var(--st-border)] text-left text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
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
                    <tr key={i} className="border-b border-[var(--st-border)]/60">
                      <td className="py-2 pr-3 text-[var(--st-text)]">
                        {it.description ?? '—'}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[var(--st-text)]">
                        {it.hsn ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {it.quantity ?? '—'} {it.unit ?? ''}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {inr(it.taxableValue)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {inr(it.cgst)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {inr(it.sgst)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {inr(it.igst)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            {bill.linkedInvoiceId ? (
              <li>
                <Link
                  href={`/dashboard/crm/sales/invoices/${bill.linkedInvoiceId}`}
                  className="text-[var(--st-text)] hover:underline"
                >
                  Source invoice → {String(bill.linkedInvoiceId)}
                </Link>
              </li>
            ) : null}
            {documents.length === 0 ? (
              <li className="text-[var(--st-text-secondary)]">
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
                      className="text-[var(--st-text)] hover:underline"
                    >
                      {d.name ?? d.url}
                    </a>
                  ) : (
                    <span className="text-[var(--st-text)]">{d.name ?? '—'}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardBody>
          {history.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">No history.</p>
          ) : (
            <ol className="flex flex-col gap-2 text-[12px]">
              {history.map((h, i) => (
                <li
                  key={i}
                  className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--st-text)]">{h.kind}</span>
                    <span className="text-[var(--st-text-secondary)]">
                      {fmtDateTime(h.at)}
                    </span>
                  </div>
                  {h.reason ? (
                    <p className="mt-1 text-[var(--st-text-secondary)]">{h.reason}</p>
                  ) : null}
                  {h.details ? (
                    <pre className="mt-1 whitespace-pre-wrap text-[10px] text-[var(--st-text-secondary)]">
                      {JSON.stringify(h.details, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </EntityDetailShell>
  );
}
