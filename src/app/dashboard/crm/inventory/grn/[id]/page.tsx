/**
 * GRN detail — `/dashboard/crm/inventory/grn/[id]`.
 *
 * Server component: hydrates the GRN via the Rust client, resolves the
 * vendor / warehouse / inspector chips through `<EntityPickerChip>`,
 * and renders the line-item table. Edit and Back actions live on this
 * page; the delete dialog is on the list page.
 *
 * GRNs skip the custom-field panel — `'grn'` is not a registered
 * `WsCustomFieldBelongsTo` key.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageCheck, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getGrn } from '@/app/actions/crm/grns.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  return status
    .split('_')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

function fmtQty(n?: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n);
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

export default async function GrnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { grn, error } = await getGrn(id);

  if (!grn) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this GRN — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/inventory/grn">
              <ArrowLeft className="h-4 w-4" /> Back to GRNs
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const items = grn.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={grn.grnNo || 'GRN'}
        subtitle={`Received on ${fmtDate(grn.date)}`}
        icon={PackageCheck}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/inventory/grn">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/inventory/grn/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Header
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="GRN number">{grn.grnNo || '—'}</Field>
            <Field label="Receipt date">{fmtDate(grn.date)}</Field>
            <Field label="Vendor">
              {grn.vendorId ? (
                <EntityPickerChip entity="vendor" id={grn.vendorId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Warehouse">
              {grn.warehouseId ? (
                <EntityPickerChip entity="warehouse" id={grn.warehouseId} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Linked PO">
              {grn.poId ? (
                <span className="font-mono text-[12px]">{grn.poId}</span>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Inspector">
              {grn.inspectorId ? (
                <EntityPickerChip entity="user" id={grn.inspectorId} />
              ) : (
                '—'
              )}
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Status
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Workflow">
              {grn.status ? (
                <ZoruBadge variant="outline">
                  {statusLabel(
                    typeof grn.status === 'string' ? grn.status : undefined,
                  )}
                </ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Issued (GIN)">
              {grn.ginId ? (
                <span className="font-mono text-[12px]">{grn.ginId}</span>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Returned (MRN)">
              {grn.mrnId ? (
                <span className="font-mono text-[12px]">{grn.mrnId}</span>
              ) : (
                '—'
              )}
            </Field>
          </div>
        </ZoruCard>
      </div>

      <ZoruCard className="overflow-hidden p-0">
        <div className="border-b border-zoru-line p-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Line items
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2 text-left text-zoru-ink-muted">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Ordered</th>
                <th className="px-3 py-2 text-right font-medium">Received</th>
                <th className="px-3 py-2 text-right font-medium">Accepted</th>
                <th className="px-3 py-2 text-right font-medium">Rejected</th>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Expiry</th>
                <th className="px-3 py-2 font-medium">Serial nos.</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="h-20 px-3 text-center text-zoru-ink-muted"
                  >
                    No line items.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-zoru-line/60 text-zoru-ink"
                  >
                    <td className="px-3 py-2">
                      {it.itemId ? (
                        <EntityPickerChip entity="item" id={it.itemId} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtQty(it.orderedQty)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtQty(it.receivedQty)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtQty(it.acceptedQty)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtQty(it.rejectedQty)}
                    </td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {it.batch || '—'}
                    </td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {fmtDate(it.expiry)}
                    </td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {Array.isArray(it.serialNos) && it.serialNos.length > 0
                        ? it.serialNos.join(', ')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(grn.createdAt || grn.audit?.createdAt)} · Updated{' '}
        {fmtDate(grn.updatedAt || grn.audit?.updatedAt)}
      </div>
    </div>
  );
}
