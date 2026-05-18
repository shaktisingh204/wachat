import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
  ArrowLeft,
  Truck,
  Pencil,
  Receipt,
  Mail,
  Printer,
  Share2,
  Copy,
  Archive,
  Activity,
  Trash2,
  } from 'lucide-react';

/**
 * Delivery Challan detail — `/dashboard/crm/sales/delivery/[challanId]`.
 *
 * §1D detail surface (thin variant). Renders:
 *   - Header card (challan no, date, status pill via `statusToTone`,
 *     reason for transport, ship-to)
 *   - Vehicle & transport info card (vehicle, driver, transporter, LR
 *     no/date, mode, e-way bill)
 *   - Line items table — serial numbers / batch / expiry shown inline
 *   - Right rail: LineageRail (sales chain — Lead → Deal → Quote →
 *     Sales Order → Delivery Challan [current] → Invoice → Receipt)
 *   - 10 action buttons: Edit · Convert→Invoice · Email · Print ·
 *     Share · Duplicate · Archive · Activity · Delete · Back
 *
 * The action layer + Mongo schema are unchanged from the legacy
 * version; new fields (transporterId, lrNumber, lrDate, ewayBillNumber,
 * batch, expiry, serialNumbers) are read defensively via casts so this
 * page renders whether the saved payload is new-shape or old.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { getDeliveryChallanById } from '@/app/actions/crm-delivery-challans.actions';
import type { LineageRef } from '@/lib/definitions';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function DeliveryChallanDetailPage({
  params,
}: {
  params: Promise<{ challanId: string }>;
}) {
  const { challanId } = await params;
  const dc = await getDeliveryChallanById(challanId);
  if (!dc) notFound();

  const id = String(dc._id);
  const challanNo = dc.challanNumber || 'Delivery Challan';
  const lineItems = dc.lineItems ?? [];
  const transport = dc.transportDetails ?? {};
  // Loose-shaped extras (forward-compat with the §1D form).
  const dcExtra = dc as unknown as {
    lrNumber?: string;
    lrDate?: string | Date;
    ewayBillNumber?: string;
    transporterId?: string;
    warehouseId?: string;
    soRef?: string;
    shipTo?: { line1?: string; city?: string; state?: string; postalCode?: string; country?: string };
    shippingAddress?: { line1?: string; city?: string; state?: string; postalCode?: string; country?: string };
  };
  const ship = dcExtra.shipTo ?? dcExtra.shippingAddress ?? {};
  const lineage: LineageRef[] = (dc.lineage as LineageRef[] | undefined) ?? [];
  const soRefFromLineage = lineage.find((l) => l.kind === 'salesOrder')?.id;
  const soRef = dcExtra.soRef ?? soRefFromLineage;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={challanNo}
        subtitle={`Delivery challan · ${fmtDate(dc.challanDate)}`}
        icon={Truck}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/sales/delivery">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton disabled title="Edit — coming soon">
              <Pencil className="h-4 w-4" /> Edit
            </ZoruButton>
          </>
        }
      />

      {/* Action group ─────────────────────────────────────────────── */}
      <ZoruCard className="flex flex-wrap items-center gap-2 p-3">
        <ZoruButton variant="default" size="sm" asChild>
          <Link
            href={`/dashboard/crm/sales/invoices/new?fromKind=deliveryChallan&fromId=${id}`}
          >
            <Receipt className="h-3.5 w-3.5" /> Convert to invoice
          </Link>
        </ZoruButton>
        <span className="mx-1 h-4 w-px bg-zoru-line" />
        <ZoruButton variant="outline" size="sm" disabled title="Email — coming soon">
          <Mail className="h-3.5 w-3.5" /> Email
        </ZoruButton>
        <ZoruButton variant="outline" size="sm" asChild>
          <Link
            href={`/dashboard/crm/sales/delivery/${id}?print=1`}
            target="_blank"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Link>
        </ZoruButton>
        <ZoruButton variant="outline" size="sm" disabled title="Share — coming soon">
          <Share2 className="h-3.5 w-3.5" /> Share
        </ZoruButton>
        <ZoruButton variant="outline" size="sm" disabled title="Duplicate — coming soon">
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </ZoruButton>
        <ZoruButton variant="outline" size="sm" disabled title="Archive — coming soon">
          <Archive className="h-3.5 w-3.5" /> Archive
        </ZoruButton>
        <ZoruButton variant="outline" size="sm" disabled title="Activity — coming soon">
          <Activity className="h-3.5 w-3.5" /> Activity
        </ZoruButton>
        <ZoruButton
          variant="outline"
          size="sm"
          disabled
          className="text-zoru-danger-ink"
          title="Delete — use the list page's row action"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ZoruButton>
      </ZoruCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Header card */}
          <ZoruCard className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Header
              </h3>
              {dc.status ? (
                <StatusPill label={dc.status} tone={statusToTone(dc.status)} />
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Challan #">{challanNo}</Field>
              <Field label="Date">{fmtDate(dc.challanDate)}</Field>
              <Field label="Customer">
                {dc.accountId ? (
                  <EntityPickerChip entity="client" id={String(dc.accountId)} />
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Linked sales order">
                {soRef ? (
                  <Link
                    href={`/dashboard/crm/sales/orders/${soRef}`}
                    className="text-zoru-primary hover:underline"
                  >
                    {soRef.slice(-8)}
                  </Link>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Reason for transport">{dc.reason || '—'}</Field>
              <Field label="Dispatch warehouse">
                {dcExtra.warehouseId ? (
                  <EntityPickerChip entity="warehouse" id={dcExtra.warehouseId} />
                ) : (
                  '—'
                )}
              </Field>
              <div className="md:col-span-2">
                <Field label="Ship-to address">
                  {ship.line1 ? (
                    <span>
                      {ship.line1}
                      {ship.city ? `, ${ship.city}` : ''}
                      {ship.state ? `, ${ship.state}` : ''}
                      {ship.postalCode ? ` ${ship.postalCode}` : ''}
                      {ship.country ? `, ${ship.country}` : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </Field>
              </div>
            </div>
          </ZoruCard>

          {/* Vehicle & transport */}
          <ZoruCard className="p-6">
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Vehicle & transport
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Vehicle number">{transport.vehicleNumber || '—'}</Field>
              <Field label="Driver">{transport.driverName || '—'}</Field>
              <Field label="Transporter">
                {dcExtra.transporterId ? (
                  <EntityPickerChip entity="employee" id={dcExtra.transporterId} />
                ) : (
                  '—'
                )}
              </Field>
              <Field label="LR / consignment no">{dcExtra.lrNumber || '—'}</Field>
              <Field label="LR date">{fmtDate(dcExtra.lrDate)}</Field>
              <Field label="E-way bill no">{dcExtra.ewayBillNumber || '—'}</Field>
              <Field label="Mode of transport">{transport.mode || '—'}</Field>
            </div>
          </ZoruCard>

          {/* Line items */}
          <ZoruCard className="p-6">
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Line items
            </h3>
            <div className="overflow-x-auto rounded-md border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead className="bg-zoru-surface-2 text-left text-zoru-ink-muted">
                  <tr>
                    <th className="p-2.5 font-medium">#</th>
                    <th className="p-2.5 font-medium">Item</th>
                    <th className="p-2.5 font-medium">HSN</th>
                    <th className="p-2.5 text-right font-medium">Qty</th>
                    <th className="p-2.5 font-medium">Unit</th>
                    <th className="p-2.5 font-medium">Batch</th>
                    <th className="p-2.5 font-medium">Expiry</th>
                    <th className="p-2.5 font-medium">Serial nos</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr className="border-t border-zoru-line">
                      <td
                        colSpan={8}
                        className="p-4 text-center text-[12.5px] text-zoru-ink-muted"
                      >
                        No line items.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((li, idx) => {
                      const anyLi = li as unknown as {
                        itemId?: string;
                        serialNumbers?: string[];
                        serialNos?: string[];
                        batch?: string;
                        expiry?: string | Date;
                      };
                      const serials =
                        Array.isArray(anyLi.serialNumbers)
                          ? anyLi.serialNumbers
                          : Array.isArray(anyLi.serialNos)
                            ? anyLi.serialNos
                            : [];
                      return (
                        <tr key={li.id ?? idx} className="border-t border-zoru-line align-top">
                          <td className="p-2.5 text-zoru-ink-muted">{idx + 1}</td>
                          <td className="p-2.5">
                            {anyLi.itemId ? (
                              <EntityPickerChip entity="item" id={anyLi.itemId} />
                            ) : (
                              <span className="text-zoru-ink">{li.name || '—'}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-zoru-ink-muted">
                            {li.hsnCode || '—'}
                          </td>
                          <td className="p-2.5 text-right tabular-nums text-zoru-ink">
                            {li.quantity}
                          </td>
                          <td className="p-2.5 text-zoru-ink-muted">{li.unit || '—'}</td>
                          <td className="p-2.5 text-zoru-ink">{anyLi.batch || '—'}</td>
                          <td className="p-2.5 text-zoru-ink">
                            {anyLi.expiry ? fmtDate(anyLi.expiry) : '—'}
                          </td>
                          <td className="p-2.5 text-zoru-ink">
                            {serials.length ? serials.join(', ') : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ZoruCard>

          {dc.notes ? (
            <ZoruCard className="p-6">
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Notes
              </h3>
              <div className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {dc.notes}
              </div>
            </ZoruCard>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <LineageRail
            current={{
              kind: 'deliveryChallan',
              id,
              no: dc.challanNumber,
              status: dc.status,
            }}
            lineage={lineage}
          />
          <ZoruCard className="p-4 text-[11.5px] text-zoru-ink-muted">
            Created {fmtDate(dc.createdAt)}
            <br />
            Updated {fmtDate(dc.updatedAt)}
          </ZoruCard>
        </div>
      </div>

      <EntityAuditTimeline entityKind="deliveryChallan" entityId={challanId} />
    </div>
  );
}
