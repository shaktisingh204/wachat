/**
 * <SalesOrdersDetailFulfillment> — pure presentational helper for the
 * Sales Order detail page. Renders a row-per-line table with a small
 * fulfillment progress bar (delivered / invoiced) per line.
 *
 * The component is server-safe (no client directive) — it has no
 * interactivity.
 */

import type { CrmSalesOrderLineItem } from '@/lib/rust-client/crm-sales-orders';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { itemApi } from '@/lib/rust-client/crm-items';
import { AlertCircle } from 'lucide-react';

interface Props {
  items: CrmSalesOrderLineItem[];
  currency: string;
}

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value.toFixed(2)}`;
  }
}

function pct(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

function ProgressBar({ pct, tone }: { pct: number; tone: 'amber' | 'green' }) {
  const fill =
    tone === 'green'
      ? 'bg-[var(--st-text)]'
      : 'bg-[var(--st-text)]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--st-border)]">
      <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export async function SalesOrdersDetailFulfillment({ items, currency }: Props) {
  const stockMap: Record<string, number> = {};

  if (items.length > 0) {
    const uniqueItemIds = Array.from(new Set(items.map(li => li.itemId).filter(Boolean))) as string[];
    
    if (uniqueItemIds.length > 0) {
      const promises = uniqueItemIds.map(id => itemApi.getById(id).catch(() => null));
      const fetchedItems = await Promise.all(promises);
      
      fetchedItems.forEach(item => {
        if (item && item._id) {
          stockMap[item._id] = item.totalStock || 0;
        }
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--st-bg-muted)] text-left text-[var(--st-text-secondary)]">
          <tr>
            <th className="p-2.5 font-medium">#</th>
            <th className="p-2.5 font-medium">Item</th>
            <th className="p-2.5 font-medium">Warehouse</th>
            <th className="p-2.5 text-right font-medium">Qty</th>
            <th className="p-2.5 text-right font-medium">Unit price</th>
            <th className="p-2.5 text-right font-medium">Tax</th>
            <th className="p-2.5 text-right font-medium">Total</th>
            <th className="min-w-[180px] p-2.5 font-medium">Fulfillment</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr className="border-t border-[var(--st-border)]">
              <td
                colSpan={8}
                className="p-4 text-center text-[12.5px] text-[var(--st-text-secondary)]"
              >
                No line items.
              </td>
            </tr>
          ) : (
            items.map((li, idx) => {
              const qty = Number(li.qty) || 0;
              const delivered = Number(li.qtyDelivered) || 0;
              const invoiced = Number(li.qtyInvoiced) || 0;
              const pending =
                li.qtyPending != null ? Number(li.qtyPending) : Math.max(0, qty - delivered);
              const delPct = pct(delivered, qty);
              const invPct = pct(invoiced, qty);

              const itemIdStr = li.itemId ? String(li.itemId) : null;
              const availableStock = itemIdStr ? stockMap[itemIdStr] : undefined;
              const isOutOfStock = availableStock !== undefined && pending > availableStock;

              return (
                <tr key={idx} className="border-t border-[var(--st-border)] align-top">
                  <td className="p-2.5 text-[var(--st-text-secondary)]">{idx + 1}</td>
                  <td className="p-2.5">
                    {li.itemId ? (
                      <EntityPickerChip entity="item" id={li.itemId} />
                    ) : (
                      <span className="text-[var(--st-text-secondary)]">
                        {li.description || '—'}
                      </span>
                    )}
                    {li.hsnSac ? (
                      <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        HSN/SAC: {li.hsnSac}
                      </div>
                    ) : null}
                    {isOutOfStock ? (
                      <div className="mt-1.5 flex items-center text-[11px] text-[var(--st-text)] font-medium bg-[var(--st-bg-muted)] px-1.5 py-0.5 rounded-sm w-fit border border-[var(--st-border)]">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Out of stock ({availableStock} available)
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2.5">
                    {li.warehouseId ? (
                      <EntityPickerChip entity="warehouse" id={li.warehouseId} />
                    ) : (
                      <span className="text-[var(--st-text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {qty}
                    {li.unit ? (
                      <span className="ml-1 text-[11.5px] text-[var(--st-text-secondary)]">
                        {li.unit}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {fmtMoney(li.rate, currency)}
                  </td>
                  <td className="p-2.5 text-right tabular-nums text-[var(--st-text-secondary)]">
                    {li.taxRatePct != null ? `${li.taxRatePct}%` : '—'}
                  </td>
                  <td className="p-2.5 text-right tabular-nums text-[var(--st-text)]">
                    {fmtMoney(li.total, currency)}
                  </td>
                  <td className="p-2.5">
                    <div className="flex flex-col gap-2 text-[11px] text-[var(--st-text-secondary)]">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span>Delivered</span>
                          <span className="tabular-nums text-[var(--st-text)]">
                            {delivered}/{qty} ({delPct}%)
                          </span>
                        </div>
                        <ProgressBar pct={delPct} tone={delPct === 100 ? 'green' : 'amber'} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span>Invoiced</span>
                          <span className="tabular-nums text-[var(--st-text)]">
                            {invoiced}/{qty} ({invPct}%)
                          </span>
                        </div>
                        <ProgressBar pct={invPct} tone={invPct === 100 ? 'green' : 'amber'} />
                      </div>
                      {pending > 0 ? (
                        <div className="text-[10.5px] text-[var(--st-text-secondary)]">
                          Pending: {pending}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
