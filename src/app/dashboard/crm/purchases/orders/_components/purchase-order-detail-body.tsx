import { Card } from '@/components/sabcrm/20ui/compat';
/**
 * <PurchaseOrderDetailBody> — body cards on the PO detail page.
 *
 * Pure server component (no client directive). Renders Overview,
 * Approval workflow, Vendor block, Line items + totals, Money summary.
 * The dynamic / mutating regions live elsewhere (right rail, header
 * actions, quick-edits).
 */

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmPurchaseOrderDoc } from '@/lib/rust-client/crm-purchase-orders';

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

interface PurchaseOrderDetailBodyProps {
  order: CrmPurchaseOrderDoc;
  vendor: { name: string | null; email: string | null; phone: string | null };
}

export function PurchaseOrderDetailBody({
  order,
  vendor,
}: PurchaseOrderDetailBodyProps) {
  const currency = order.currency || 'INR';
  const status = order.status ?? 'draft';
  const totals = order.totals ?? { subTotal: 0, total: 0 };
  const items = order.items ?? [];

  return (
    <>
      {/* Overview */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="PO number">{order.poNo || '—'}</DetailField>
          <DetailField label="Status">
            <StatusPill
              label={String(status).replace(/_/g, ' ')}
              tone={statusToTone(status)}
            />
          </DetailField>
          <DetailField label="PO date">{fmtDate(order.date)}</DetailField>
          <DetailField label="Expected delivery">
            {fmtDate(order.expectedDelivery)}
          </DetailField>
          <DetailField label="Currency">{currency}</DetailField>
          <DetailField label="Payment terms">
            {order.paymentTerms || '—'}
          </DetailField>
          <DetailField label="Ship-to warehouse">
            {order.shipToWarehouseId ? (
              <EntityPickerChip
                entity="warehouse"
                id={order.shipToWarehouseId}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Billing branch">
            {order.billingBranchId ? (
              <EntityPickerChip entity="branch" id={order.billingBranchId} />
            ) : (
              '—'
            )}
          </DetailField>
        </div>
      </Card>

      {/* Approval workflow */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Approval workflow
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Requested by">
            {order.approval?.requestedBy ? (
              <EntityPickerChip
                entity="user"
                id={order.approval.requestedBy}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Requested at">
            {fmtDate(order.approval?.requestedAt)}
          </DetailField>
          <DetailField label="Approved by">
            {order.approval?.approvedBy ? (
              <EntityPickerChip
                entity="user"
                id={order.approval.approvedBy}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Approved at">
            {fmtDate(order.approval?.approvedAt)}
          </DetailField>
          {order.approval?.note ? (
            <DetailField label="Approval notes">
              <pre className="whitespace-pre-wrap font-sans text-[13px]">
                {order.approval.note}
              </pre>
            </DetailField>
          ) : null}
        </div>
        {/* TODO 1D.x: Approval workflow chain UI — show full audit log
            of approval transitions with timestamps + actor chips. */}
      </Card>

      {/* Vendor */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Vendor
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Vendor">
            {order.vendorId ? (
              <EntityPickerChip entity="vendor" id={order.vendorId} />
            ) : (
              vendor.name ?? '—'
            )}
          </DetailField>
          {vendor.email ? (
            <DetailField label="Primary email">{vendor.email}</DetailField>
          ) : null}
          {vendor.phone ? (
            <DetailField label="Primary phone">{vendor.phone}</DetailField>
          ) : null}
        </div>
      </Card>

      {/* Line items */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Line items
        </h2>
        {items.length === 0 ? (
          <p className="text-[13px] text-zoru-ink-muted">No line items.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zoru-line">
            <table className="w-full text-[13px]">
              <thead className="bg-zoru-surface-2">
                <tr className="border-b border-zoru-line text-left">
                  <th className="p-2 font-medium text-zoru-ink">Item</th>
                  <th className="p-2 font-medium text-zoru-ink">Description</th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Qty
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Rate
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Disc %
                  </th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Tax %
                  </th>
                  <th className="p-2 font-medium text-zoru-ink">Warehouse</th>
                  <th className="p-2 text-right font-medium text-zoru-ink">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zoru-line last:border-b-0"
                  >
                    <td className="p-2 align-top">
                      {li.itemId ? (
                        <EntityPickerChip entity="item" id={li.itemId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </td>
                    <td className="p-2 align-top text-zoru-ink">
                      {li.description || '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {li.qty}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {fmtMoney(li.rate, currency)}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink-muted">
                      {li.discountPct != null ? `${li.discountPct}%` : '—'}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink-muted">
                      {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                    </td>
                    <td className="p-2 align-top">
                      {li.warehouseId ? (
                        <EntityPickerChip
                          entity="warehouse"
                          id={li.warehouseId}
                        />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right align-top tabular-nums text-zoru-ink">
                      {fmtMoney(li.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zoru-surface-2/50 font-medium">
                  <td className="p-2" colSpan={7}>
                    Subtotal
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {fmtMoney(totals.subTotal, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Money summary */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Money summary
        </h2>
        <div className="ml-auto max-w-sm space-y-2 text-[13px]">
          <SummaryLine
            label="Subtotal"
            value={fmtMoney(totals.subTotal, currency)}
          />
          {totals.discountOverall != null ? (
            <SummaryLine
              label="Discount"
              value={`-${fmtMoney(totals.discountOverall, currency)}`}
            />
          ) : null}
          {totals.shippingCharge != null ? (
            <SummaryLine
              label="Shipping"
              value={fmtMoney(totals.shippingCharge, currency)}
            />
          ) : null}
          {totals.adjustment != null ? (
            <SummaryLine
              label="Adjustment"
              value={fmtMoney(totals.adjustment, currency)}
            />
          ) : null}
          {totals.roundOff != null ? (
            <SummaryLine
              label="Round off"
              value={fmtMoney(totals.roundOff, currency)}
            />
          ) : null}
          <div className="flex justify-between border-t border-zoru-line pt-2">
            <span className="font-medium text-zoru-ink">Total</span>
            <span className="text-base font-semibold tabular-nums text-zoru-ink">
              {fmtMoney(totals.total, currency)}
            </span>
          </div>
        </div>
      </Card>
    </>
  );
}

function DetailField({
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zoru-ink-muted">{label}</span>
      <span className="font-mono tabular-nums text-zoru-ink">{value}</span>
    </div>
  );
}
