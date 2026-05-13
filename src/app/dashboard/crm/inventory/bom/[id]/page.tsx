/**
 * BOM detail page — server component.
 *
 * Linked from the BOM list. Uses <EntityDetailShell> with eyebrow,
 * title, back link, status pill, and an "Edit" action.
 *
 * Fetches the BOM via `getCrmBomById`. Activity footer is rendered
 * via `audit: { entityKind: 'bom', entityId }`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getCrmBomById } from '@/app/actions/crm-bom.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function statusTone(status: string | undefined): EntityStatusTone {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'closed') return 'green';
  if (s === 'draft' || s === 'pending') return 'neutral';
  if (s === 'cancelled' || s === 'expired') return 'red';
  return 'amber';
}

export default async function BomDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await getCrmBomById(id);
  if (!bom) notFound();

  const components = Array.isArray(bom.components) ? bom.components : [];
  const title = bom.bomNo || bom.finishedGoodName || 'BOM';

  return (
    <EntityDetailShell
      eyebrow="BILL OF MATERIALS"
      title={title}
      status={{ label: bom.status || 'draft', tone: statusTone(bom.status) }}
      back={{ href: '/dashboard/crm/inventory/bom', label: 'Back to all BOMs' }}
      actions={
        <>
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/bom/${id}/activity`}>
              View activity
            </Link>
          </ZoruButton>
          <ZoruButton size="sm" asChild>
            <Link href={`/dashboard/crm/inventory/bom/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </Link>
          </ZoruButton>
        </>
      }
      audit={{ entityKind: 'bom', entityId: id }}
    >
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Header</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">BOM no.</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{bom.bomNo || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Finished good</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {bom.finishedGoodName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Output qty</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {typeof bom.outputQty === 'number' ? bom.outputQty : '—'}{' '}
                {bom.unit || ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Version</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {bom.version || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Effective date</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {formatDate(bom.effectiveDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Created</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {formatDate(bom.createdAt)}
              </dd>
            </div>
            {bom.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Notes</dt>
                <dd className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                  {bom.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Components ({components.length})</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {components.length === 0 ? (
            <p className="text-sm text-zinc-500">No components yet.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                      Unit
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">
                      Scrap %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c, idx) => (
                    <tr
                      key={`${c.itemName}-${idx}`}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2">{c.itemName || '—'}</td>
                      <td className="px-3 py-2">{c.qty}</td>
                      <td className="px-3 py-2">{c.unit || '—'}</td>
                      <td className="px-3 py-2">{c.scrapPct ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </EntityDetailShell>
  );
}
