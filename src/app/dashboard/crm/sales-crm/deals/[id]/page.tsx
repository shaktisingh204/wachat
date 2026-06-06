import { Badge, Button, Card } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ClipboardList } from 'lucide-react';

/**
 * Deal detail — `/dashboard/crm/sales-crm/deals/[id]`.
 *
 * Server component. Loads the deal, projects it for the client islands,
 * and assembles the §1D.2 detail surface:
 *   - Header: status pill (click → stage change), 9+ action buttons
 *     (Edit, Convert, Email, WhatsApp, Add Task, Print, Archive, Mark
 *     Won, Mark Lost, Activity).
 *   - Body cards: Overview, Money breakdown, Products, Notes composer,
 *     Tags.
 *   - Right rail: pipeline progress, owner/stage/status (quick-edit
 *     chips), related entities (live counts), LineageRail.
 *   - Footer: <EntityAuditTimeline entityKind="deal" entityId={id} />.
 *   - `?print=1` renders a single-column print layout (no sidebar, no
 *     action group, no audit footer).
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { CrmNotes } from '@/components/zoruui-domain/crm-notes';
import { getCrmDealById, getCrmDealRelatedCounts } from '@/app/actions/crm-deals.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';

import { DealDetailActions } from '../_components/deal-detail-actions';
import { DealQuickEdits } from '../_components/deal-quick-edits';
import { DealRelatedRail } from '../_components/deal-related-rail';
import { DealDetailClient } from '../_components/deal-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
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

async function fetchContactPrimary(
  contactId: string | null,
  accountId: string | null,
  userId: ObjectId,
): Promise<{ email: string | null; phone: string | null }> {
  if (!contactId && !accountId) return { email: null, phone: null };
  try {
    const { db } = await connectToDatabase();
    let contact: any = null;
    if (contactId && ObjectId.isValid(contactId)) {
      contact = await db.collection('crm_contacts').findOne(
        { _id: new ObjectId(contactId), userId } as Record<string, unknown>,
        { projection: { email: 1, phone: 1 } },
      );
    }
    if ((!contact || (!contact.email && !contact.phone)) && accountId && ObjectId.isValid(accountId)) {
      const account = await db.collection('crm_accounts').findOne(
        { _id: new ObjectId(accountId), userId } as Record<string, unknown>,
        { projection: { email: 1, phone: 1 } },
      );
      if (account) {
        return {
          email: (account as any).email ?? null,
          phone: (account as any).phone ?? null,
        };
      }
    }
    return {
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    };
  } catch {
    return { email: null, phone: null };
  }
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function DealDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const printMode = sp?.print === '1';

  const session = await getSession();
  const deal = await getCrmDealById(id);
  if (!deal || !session?.user?._id) notFound();

  const dealIdStr = String(deal._id);
  const accountId = deal.accountId ? String(deal.accountId) : null;
  const contactId = deal.contactIds?.[0] ? String(deal.contactIds[0]) : null;

  const userObjectId = new ObjectId(String(session.user._id));
  const [related, contactPrimary] = await Promise.all([
    getCrmDealRelatedCounts(dealIdStr),
    fetchContactPrimary(contactId, accountId, userObjectId),
  ]);

  const stages = getDealStagesForIndustry();
  const amount = typeof deal.value === 'number' ? deal.value : 0;
  const probabilityPct = typeof deal.probability === 'number' ? deal.probability : null;
  const weighted = probabilityPct != null ? amount * (probabilityPct / 100) : null;
  const dealCurrency = deal.currency ?? 'INR';
  const stageAge = ageInDays(deal.updatedAt);
  const dealAge = ageInDays(deal.createdAt);
  const dealStatus =
    typeof (deal as { status?: string }).status === 'string'
      ? (deal as { status?: string }).status
      : null;

  // Map persisted notes to the CrmNotes-expected shape (Date typed).
  const notesForComposer = Array.isArray(deal.notes)
    ? deal.notes.map((n) => ({
        content: n.content,
        author: n.author ?? 'Unknown',
        createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
      }))
    : [];

  if (printMode) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6 print:p-0">
        <header className="border-b border-[var(--st-border)] pb-4">
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">{deal.name || 'Untitled deal'}</h1>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            {fmtMoney(amount, dealCurrency)} · {deal.stage ?? 'Untriaged'}
          </p>
        </header>
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Overview
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <DetailField label="Owner">{deal.ownerId ? String(deal.ownerId) : '—'}</DetailField>
            <DetailField label="Pipeline">{deal.pipelineId || '—'}</DetailField>
            <DetailField label="Lead source">{deal.leadSource || '—'}</DetailField>
            <DetailField label="Priority">{deal.priority || '—'}</DetailField>
            <DetailField label="Campaign">{deal.campaign || '—'}</DetailField>
            <DetailField label="Next step">{deal.nextStep || '—'}</DetailField>
            <DetailField label="Expected close">{fmtDate(deal.closeDate)}</DetailField>
            <DetailField label="Loss reason">{deal.lossReason || '—'}</DetailField>
          </dl>
        </section>
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Money breakdown
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-[13px]">
            <Stat label="Amount" value={fmtMoney(amount, dealCurrency)} />
            <Stat label="Probability" value={probabilityPct != null ? `${probabilityPct}%` : '—'} />
            <Stat
              label="Weighted forecast"
              value={weighted != null ? fmtMoney(weighted, dealCurrency) : '—'}
            />
            <Stat label="Deal age" value={dealAge != null ? `${dealAge} d` : '—'} />
            <Stat label="Stage age" value={stageAge != null ? `${stageAge} d` : '—'} />
            <Stat label="Status" value={dealStatus || 'open'} />
          </dl>
        </section>
        {Array.isArray(deal.products) && deal.products.length > 0 ? (
          <section>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Products
            </h2>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {deal.products.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td className="text-right font-mono tabular-nums">{p.quantity}</td>
                    <td className="text-right font-mono tabular-nums">{p.price}</td>
                    <td className="text-right font-mono tabular-nums">
                      {(p.quantity ?? 0) * (p.price ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
        {deal.description ? (
          <section>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Notes
            </h2>
            <p className="whitespace-pre-wrap text-[13px]">{deal.description}</p>
          </section>
        ) : null}
        {Array.isArray(deal.labels) && deal.labels.length > 0 ? (
          <section>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              Tags
            </h2>
            <div className="flex flex-wrap gap-1.5 text-[12.5px]">
              {deal.labels.map((t) => (
                <span key={t} className="rounded border border-[var(--st-border)] px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <DealDetailClient
      deal={deal}
      dealIdStr={dealIdStr}
      accountId={accountId}
      contactId={contactId}
      stages={stages}
      amount={amount}
      probabilityPct={probabilityPct}
      weighted={weighted}
      dealCurrency={dealCurrency}
      stageAge={stageAge}
      dealAge={dealAge}
      dealStatus={dealStatus}
      contactPrimary={contactPrimary}
      related={related}
    />
  );
}

/* ─── Local presentational helpers ─────────────────────────────────── */

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">{label}</dt>
      <dd className="mt-1 font-mono text-[14px] tabular-nums text-[var(--st-text)]">{value}</dd>
    </div>
  );
}
