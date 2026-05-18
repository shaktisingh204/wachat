/**
 * Canonical Deals list — `/dashboard/crm/sales-crm/deals`.
 *
 * Server component. Reads page/limit/q from the URL and projects the
 * Mongo docs into the `DealListRow` wire-format the client islands
 * (table / kanban / calendar) consume. Computes the KPI strip
 * (open count, open value, won/lost this month, avg cycle days) in the
 * same query pass so the client doesn't need a follow-up round trip.
 *
 * Per CRM_REBUILD_PLAN §1D.1.
 */

import { ObjectId, type WithId } from 'mongodb';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import type { CrmDeal } from '@/lib/definitions';

import { DealListClient } from './_components/deal-list-client';
import type { DealKpiSummary, DealListRow } from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function toRow(
  doc: WithId<CrmDeal>,
  accountNames: Map<string, string>,
  contactNames: Map<string, string>,
): DealListRow {
  const accountId = doc.accountId ? String(doc.accountId) : null;
  const contactId = doc.contactIds?.[0] ? String(doc.contactIds[0]) : null;
  const clientLabel =
    (accountId && accountNames.get(accountId)) ||
    (contactId && contactNames.get(contactId)) ||
    undefined;

  return {
    _id: String(doc._id),
    name: doc.name ?? 'Untitled deal',
    description: doc.description,
    clientLabel,
    accountId,
    contactId,
    amount: typeof doc.value === 'number' ? doc.value : undefined,
    currency: doc.currency,
    stage: doc.stage,
    pipelineId: doc.pipelineId ?? null,
    ownerId: doc.ownerId ? String(doc.ownerId) : null,
    probability: typeof doc.probability === 'number' ? doc.probability : null,
    expectedClose: doc.closeDate ? new Date(doc.closeDate).toISOString() : null,
    status: undefined,
    priority: doc.priority,
    leadSource: doc.leadSource,
    campaign: doc.campaign,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    tags: doc.labels,
  };
}

function isWon(stage?: string): boolean {
  const s = (stage ?? '').toLowerCase();
  return s.includes('won');
}
function isLost(stage?: string): boolean {
  const s = (stage ?? '').toLowerCase();
  return s.includes('lost');
}
function isOpen(stage?: string): boolean {
  return !isWon(stage) && !isLost(stage);
}

function computeKpi(rows: DealListRow[]): DealKpiSummary {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let openCount = 0;
  let openValue = 0;
  let wonThisMonth = 0;
  let lostThisMonth = 0;
  let cycleDaysTotal = 0;
  let cycleDaysCount = 0;
  for (const r of rows) {
    const amt = typeof r.amount === 'number' ? r.amount : 0;
    if (isOpen(r.stage)) {
      openCount += 1;
      openValue += amt;
    }
    if (r.updatedAt && new Date(r.updatedAt).getTime() >= monthStart.getTime()) {
      if (isWon(r.stage)) wonThisMonth += amt;
      else if (isLost(r.stage)) lostThisMonth += amt;
    }
    if (r.createdAt && (isWon(r.stage) || isLost(r.stage))) {
      const created = new Date(r.createdAt).getTime();
      const closed = r.updatedAt ? new Date(r.updatedAt).getTime() : NaN;
      if (!Number.isNaN(created) && !Number.isNaN(closed) && closed >= created) {
        cycleDaysTotal += (closed - created) / 86_400_000;
        cycleDaysCount += 1;
      }
    }
  }
  return {
    openCount,
    openValue,
    wonThisMonth,
    lostThisMonth,
    avgCycleDays: cycleDaysCount > 0 ? cycleDaysTotal / cycleDaysCount : 0,
  };
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function DealsListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  const session = await getSession();

  let deals: DealListRow[] = [];
  let total = 0;
  let error: string | undefined;
  const stagesFromIndustry = getDealStagesForIndustry();

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(String(session.user._id));
      const filter: Record<string, unknown> = { userId: userObjectId };
      if (q) {
        // The legacy regex search lives in the action; the canonical
        // path filters client-side after a server projection. We still
        // honour a server-side title match when ?q is present so a deep
        // link to a known title is reasonably fast.
        filter.name = { $regex: q, $options: 'i' };
      }

      const skip = (page - 1) * limit;
      const [docs, count] = await Promise.all([
        db
          .collection<CrmDeal>('crm_deals')
          .find(filter as Record<string, unknown>)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection<CrmDeal>('crm_deals').countDocuments(filter as Record<string, unknown>),
      ]);

      total = count;
      const accountIds = Array.from(
        new Set(docs.filter((d) => d.accountId).map((d) => String(d.accountId))),
      );
      const contactIds = Array.from(
        new Set(
          docs
            .flatMap((d) => d.contactIds ?? [])
            .filter(Boolean)
            .map(String),
        ),
      );

      const [accountDocs, contactDocs] = await Promise.all([
        accountIds.length
          ? db
              .collection('crm_accounts')
              .find(
                {
                  userId: userObjectId,
                  _id: { $in: accountIds.map((id) => new ObjectId(id)) },
                } as Record<string, unknown>,
                { projection: { name: 1 } },
              )
              .toArray()
          : Promise.resolve([] as Array<{ _id: ObjectId; name?: string }>),
        contactIds.length
          ? db
              .collection('crm_contacts')
              .find(
                {
                  userId: userObjectId,
                  _id: { $in: contactIds.map((id) => new ObjectId(id)) },
                } as Record<string, unknown>,
                { projection: { name: 1 } },
              )
              .toArray()
          : Promise.resolve([] as Array<{ _id: ObjectId; name?: string }>),
      ]);

      const accountNames = new Map<string, string>();
      for (const a of accountDocs) accountNames.set(String(a._id), String(a.name ?? ''));
      const contactNames = new Map<string, string>();
      for (const c of contactDocs) contactNames.set(String(c._id), String(c.name ?? ''));

      deals = docs.map((doc) => toRow(doc, accountNames, contactNames));
    } catch (e) {
      console.error('[deals list] failed:', e);
      error = 'Could not load deals. Please try again.';
    }
  }

  const kpi = computeKpi(deals);

  return (
    <EntityListShell
      title="Deals"
      subtitle="Pipeline opportunities — track value, stage, and forecast in one place."
    >
      <DealListClient
        deals={deals}
        total={total}
        page={page}
        limit={limit}
        initialQuery={q}
        kpi={kpi}
        stages={stagesFromIndustry}
        defaultCurrency="INR"
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        error={error}
      />
    </EntityListShell>
  );
}
