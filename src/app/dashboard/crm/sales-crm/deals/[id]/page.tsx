/**
 * Deal detail — `/dashboard/crm/sales-crm/deals/[id]`.
 *
 * Server component. Loads the deal, projects it for the client islands,
 * and assembles the §1D.2 detail surface:
 *   - Header: status pill (click → stage change), 8+ action buttons
 *   - Body cards: Overview, Money breakdown, Products, Competitors,
 *     Notes (display only for now), Tags
 *   - Right rail: pipeline progress, owner, stage age, related entities
 *     (Quotations / Invoices / Tasks / Tickets / Contacts), LineageRail
 *   - Footer: <EntityAuditTimeline entityKind="deal" entityId={id} />
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, ClipboardList, FileText, ListChecks, Receipt, Ticket, User2 } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { getCrmDealById } from '@/app/actions/crm-deals.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';

import { DealDetailActions } from '../_components/deal-detail-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function fmtMoney(value?: number | null, currency = 'INR'): string {
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

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function ageInDays(from?: string | Date | null): number | null {
  if (!from) return null;
  const t = from instanceof Date ? from.getTime() : new Date(from).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

interface RelatedCounts {
  quotations: number;
  invoices: number;
  tasks: number;
  tickets: number;
  contacts: number;
}

async function fetchRelated(
  dealId: string,
  accountId: string | null,
  userId: ObjectId,
): Promise<RelatedCounts> {
  try {
    const { db } = await connectToDatabase();
    const objId = new ObjectId(dealId);
    const dealIdStr = String(dealId);

    const [quotations, invoices, tasks, tickets, contacts] = await Promise.all([
      db
        .collection('crm_quotations')
        .countDocuments({ userId, $or: [{ dealId: objId }, { dealId: dealIdStr }] } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_invoices')
        .countDocuments({ userId, $or: [{ dealId: objId }, { dealId: dealIdStr }] } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_tasks')
        .countDocuments({ userId, $or: [{ dealId: objId }, { dealId: dealIdStr }] } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_tickets')
        .countDocuments({ userId, $or: [{ dealId: objId }, { dealId: dealIdStr }] } as Record<string, unknown>)
        .catch(() => 0),
      accountId
        ? db
            .collection('crm_contacts')
            .countDocuments({ userId, accountId: new ObjectId(accountId) } as Record<string, unknown>)
            .catch(() => 0)
        : Promise.resolve(0),
    ]);

    return {
      quotations: Number(quotations) || 0,
      invoices: Number(invoices) || 0,
      tasks: Number(tasks) || 0,
      tickets: Number(tickets) || 0,
      contacts: Number(contacts) || 0,
    };
  } catch (e) {
    console.error('[deal detail] related fetch failed:', e);
    return { quotations: 0, invoices: 0, tasks: 0, tickets: 0, contacts: 0 };
  }
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const deal = await getCrmDealById(id);
  if (!deal || !session?.user?._id) notFound();

  const dealIdStr = String(deal._id);
  const accountId = deal.accountId ? String(deal.accountId) : null;
  const contactId = deal.contactIds?.[0] ? String(deal.contactIds[0]) : null;

  const userObjectId = new ObjectId(String(session.user._id));
  const related = await fetchRelated(dealIdStr, accountId, userObjectId);

  const stages = getDealStagesForIndustry();
  const amount = typeof deal.value === 'number' ? deal.value : 0;
  const probabilityPct = typeof deal.probability === 'number' ? deal.probability : null;
  const weighted = probabilityPct != null ? amount * (probabilityPct / 100) : null;
  const dealCurrency = deal.currency ?? 'INR';
  const stageAge = ageInDays(deal.updatedAt);
  const dealAge = ageInDays(deal.createdAt);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/sales-crm/deals"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Deals
        </Link>
        <CrmPageHeader
          title={deal.name || 'Untitled deal'}
          subtitle={`${fmtMoney(amount, dealCurrency)} · ${deal.stage ?? 'Untriaged'}`}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Sales CRM', href: '/dashboard/crm/sales-crm' },
            { label: 'Deals', href: '/dashboard/crm/sales-crm/deals' },
            { label: deal.name || 'Deal' },
          ]}
        />
        <DealDetailActions dealId={dealIdStr} stage={deal.stage ?? ''} stages={stages} />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Main column */}
        <main className="min-w-0 flex-1 space-y-6">
          {/* Overview */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Overview
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailField label="Owner">
                {deal.ownerId ? (
                  <EntityPickerChip entity="user" id={String(deal.ownerId)} />
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Pipeline">
                {deal.pipelineId ? (
                  <EntityPickerChip entity="pipeline" id={deal.pipelineId} />
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Client">
                {accountId ? (
                  <EntityPickerChip entity="client" id={accountId} />
                ) : contactId ? (
                  <EntityPickerChip entity="contact" id={contactId} />
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Lead source">{deal.leadSource || '—'}</DetailField>
              <DetailField label="Priority">{deal.priority || '—'}</DetailField>
              <DetailField label="Campaign">{deal.campaign || '—'}</DetailField>
              <DetailField label="Next step">{deal.nextStep || '—'}</DetailField>
              <DetailField label="Loss reason">{deal.lossReason || '—'}</DetailField>
            </div>
          </ZoruCard>

          {/* Money breakdown */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Money breakdown
            </h2>
            <dl className="grid gap-3 md:grid-cols-3">
              <Stat label="Amount" value={fmtMoney(amount, dealCurrency)} />
              <Stat label="Probability" value={probabilityPct != null ? `${probabilityPct}%` : '—'} />
              <Stat
                label="Weighted forecast"
                value={weighted != null ? fmtMoney(weighted, dealCurrency) : '—'}
              />
              <Stat label="Expected close" value={fmtDate(deal.closeDate)} />
              <Stat label="Deal age" value={dealAge != null ? `${dealAge} d` : '—'} />
              <Stat label="Stage age" value={stageAge != null ? `${stageAge} d` : '—'} />
            </dl>
          </ZoruCard>

          {/* Products */}
          {Array.isArray(deal.products) && deal.products.length > 0 ? (
            <ZoruCard className="p-6">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Products
              </h2>
              <div className="overflow-x-auto rounded border border-zoru-line">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deal.products.map((p, i) => {
                      const total = (p.quantity ?? 0) * (p.price ?? 0);
                      return (
                        <tr key={i} className="border-t border-zoru-line">
                          <td className="p-2">{p.name}</td>
                          <td className="p-2 text-right font-mono tabular-nums">{p.quantity}</td>
                          <td className="p-2 text-right font-mono tabular-nums">{p.price}</td>
                          <td className="p-2 text-right font-mono tabular-nums">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ZoruCard>
          ) : null}

          {/* Notes (read-only stub — full composer ships with CrmNotes adoption) */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Notes
            </h2>
            {Array.isArray(deal.notes) && deal.notes.length > 0 ? (
              <ul className="space-y-3 text-[13px] text-zoru-ink">
                {deal.notes.map((n, i) => (
                  <li key={i} className="rounded border border-zoru-line bg-zoru-surface-2 p-3">
                    <p>{n.content}</p>
                    <p className="mt-1 text-[11px] text-zoru-ink-muted">
                      {n.author ?? 'Unknown'} · {fmtDate(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : deal.description ? (
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">{deal.description}</p>
            ) : (
              <p className="text-[13px] text-zoru-ink-muted">
                No notes yet. {/* TODO 1D.2: inline note composer ships with CrmNotes adoption */}
              </p>
            )}
          </ZoruCard>

          {/* Tags */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Tags
            </h2>
            {Array.isArray(deal.labels) && deal.labels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {deal.labels.map((t) => (
                  <ZoruBadge key={t} variant="outline">
                    {t}
                  </ZoruBadge>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-zoru-ink-muted">No tags yet.</p>
            )}
          </ZoruCard>
        </main>

        {/* Right rail */}
        <aside className="w-full md:w-80 md:shrink-0">
          <div className="space-y-4 md:sticky md:top-4">
            {/* Pipeline progress */}
            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Pipeline progress
              </h3>
              <ol className="space-y-1.5">
                {stages.map((s) => {
                  const isCurrent = s === deal.stage;
                  return (
                    <li
                      key={s}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-[12.5px] ${
                        isCurrent
                          ? 'bg-zoru-surface-2 font-medium text-zoru-ink'
                          : 'text-zoru-ink-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          isCurrent ? 'bg-zoru-primary' : 'bg-zoru-line'
                        }`}
                        aria-hidden
                      />
                      {s}
                      {isCurrent ? (
                        <span className="ml-auto text-[10.5px] uppercase text-zoru-primary">
                          current
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </ZoruCard>

            {/* Owner + age */}
            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                At a glance
              </h3>
              <dl className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-zoru-ink-muted">Owner</dt>
                  <dd>
                    {deal.ownerId ? (
                      <EntityPickerChip entity="user" id={String(deal.ownerId)} />
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-zoru-ink-muted">Stage</dt>
                  <dd>
                    {deal.stage ? (
                      <StatusPill label={deal.stage} tone={statusToTone(deal.stage)} />
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-zoru-ink-muted">Stage age</dt>
                  <dd className="font-mono tabular-nums">{stageAge != null ? `${stageAge} d` : '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-zoru-ink-muted">Created</dt>
                  <dd>{fmtDate(deal.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-zoru-ink-muted">Updated</dt>
                  <dd>{fmtDate(deal.updatedAt)}</dd>
                </div>
              </dl>
            </ZoruCard>

            {/* Related entities */}
            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Related
              </h3>
              <ul className="space-y-1.5 text-[12.5px]">
                <RelatedLink
                  href={`/dashboard/crm/sales/quotations?dealId=${dealIdStr}`}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Quotations"
                  count={related.quotations}
                />
                <RelatedLink
                  href={`/dashboard/crm/sales/invoices?dealId=${dealIdStr}`}
                  icon={<Receipt className="h-3.5 w-3.5" />}
                  label="Invoices"
                  count={related.invoices}
                />
                <RelatedLink
                  href={`/dashboard/crm/sales-crm/tasks?dealId=${dealIdStr}`}
                  icon={<ListChecks className="h-3.5 w-3.5" />}
                  label="Tasks"
                  count={related.tasks}
                />
                <RelatedLink
                  href={`/dashboard/crm/tickets?dealId=${dealIdStr}`}
                  icon={<Ticket className="h-3.5 w-3.5" />}
                  label="Tickets"
                  count={related.tickets}
                />
                {accountId ? (
                  <RelatedLink
                    href={`/dashboard/crm/accounts/${accountId}`}
                    icon={<User2 className="h-3.5 w-3.5" />}
                    label="Account contacts"
                    count={related.contacts}
                  />
                ) : null}
              </ul>
            </ZoruCard>

            {/* Lineage rail */}
            <LineageRail
              current={{ kind: 'deal', id: dealIdStr, no: deal.name, status: deal.stage }}
              lineage={deal.lineage ?? []}
            />

            <ZoruButton size="sm" variant="ghost" asChild className="w-full">
              <Link href={`/dashboard/crm/sales-crm/deals/${dealIdStr}/activity`}>
                <ClipboardList className="h-3.5 w-3.5" />
                View full activity log
              </Link>
            </ZoruButton>
          </div>
        </aside>
      </div>

      {/* Audit footer */}
      <EntityAuditTimeline entityKind="deal" entityId={dealIdStr} />
    </div>
  );
}

/* ─── Local presentational helpers ─────────────────────────────────── */

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">{label}</dt>
      <dd className="mt-1 font-mono text-[14px] tabular-nums text-zoru-ink">{value}</dd>
    </div>
  );
}

function RelatedLink({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-zoru-ink hover:bg-zoru-surface-2"
      >
        <span className="inline-flex items-center gap-1.5 text-zoru-ink">
          <span className="text-zoru-ink-muted">{icon}</span>
          {label}
        </span>
        <span className="font-mono tabular-nums text-zoru-ink-muted">{count}</span>
      </Link>
    </li>
  );
}
