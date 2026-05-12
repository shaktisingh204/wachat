/**
 * RFQ detail — `/dashboard/crm/purchases/rfqs/[id]`.
 *
 * Server component: hydrates the RFQ via the Rust client, resolves the
 * invited-vendor chips through `<EntityPickerChip>`, and renders the
 * line-item table and workflow state. Edit and Back actions live on
 * this page; the delete dialog is on the list page.
 *
 * RFQs skip the custom-field panel — `'rfq'` is not a registered
 * `WsCustomFieldBelongsTo` key.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClipboardList, Pencil, ArrowLeft } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getRfq } from '@/app/actions/crm/rfqs.actions';

export const dynamic = 'force-dynamic';

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  return status[0].toUpperCase() + status.slice(1);
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

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { rfq, error } = await getRfq(id);

  if (!rfq) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this RFQ — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/rfqs">
              <ArrowLeft className="h-4 w-4" /> Back to RFQs
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const items = rfq.items ?? [];
  const vendors = rfq.vendorsInvited ?? [];
  const attachments = rfq.attachments ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={rfq.title || 'RFQ'}
        subtitle={`Requested by ${fmtDate(rfq.requiredBy)} · Deadline ${fmtDate(rfq.deadline)}`}
        icon={ClipboardList}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/purchases/rfqs">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/purchases/rfqs/${id}/edit`}>
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
            <Field label="Title">{rfq.title || '—'}</Field>
            <Field label="Required by">{fmtDate(rfq.requiredBy)}</Field>
            <Field label="Submission deadline">{fmtDate(rfq.deadline)}</Field>
            <Field label="Created">
              {fmtDate(rfq.createdAt || rfq.audit?.createdAt)}
            </Field>
            <Field label="Terms">
              <span className="whitespace-pre-line">{rfq.terms || '—'}</span>
            </Field>
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Status
          </h3>
          <div className="flex flex-col gap-4">
            <Field label="Workflow">
              {rfq.status ? (
                <ZoruBadge variant="outline">
                  {statusLabel(
                    typeof rfq.status === 'string' ? rfq.status : undefined,
                  )}
                </ZoruBadge>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Vendors invited">
              {vendors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {vendors.map((vid) => (
                    <EntityPickerChip key={vid} entity="vendor" id={vid} />
                  ))}
                </div>
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
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Specs / notes</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                    <td className="px-3 py-2">{it.description || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {it.qty ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {it.unit || '—'}
                    </td>
                    <td className="px-3 py-2 text-zoru-ink-muted">
                      {it.specs || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZoruCard>

      {attachments.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Attachments
          </h3>
          <ul className="flex flex-col gap-1.5">
            {attachments.map((a, idx) => (
              <li
                key={`${a.fileId ?? 'att'}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-3 py-2 text-[12.5px]"
              >
                <span className="truncate text-zoru-ink">
                  {a.name || a.fileId || 'Attachment'}
                </span>
                {a.url ? (
                  <Link
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-zoru-ink-muted hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </ZoruCard>
      ) : null}

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(rfq.createdAt || rfq.audit?.createdAt)} · Updated{' '}
        {fmtDate(rfq.updatedAt || rfq.audit?.updatedAt)}
      </div>
    </div>
  );
}
