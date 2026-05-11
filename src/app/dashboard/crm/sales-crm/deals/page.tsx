import { Plus, Handshake } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type AnyDeal = {
  _id?: { toString(): string } | string;
  title?: string;
  clientName?: string;
  clientId?: string;
  pipelineId?: string;
  stage?: string;
  amount?: number;
  currency?: string;
  probability?: number;
  expectedClose?: string | Date;
  owner?: string;
  status?: string;
  createdAt?: string | Date;
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatAmount(deal: AnyDeal): string {
  // `amount` is the AnyDeal field; fall back to the CrmDeal `value` field
  const raw = deal.amount ?? (deal as any).value;
  if (raw == null || Number.isNaN(Number(raw))) return '—';
  return inrFormatter.format(Number(raw));
}

function getStageBadgeVariant(
  stage?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (stage || '').toLowerCase();
  if (s === 'closed won' || s === 'won' || s === 'closed') return 'success';
  if (s === 'closed lost' || s === 'lost') return 'danger';
  if (s === 'proposal' || s === 'negotiation' || s === 'proposal sent') return 'warning';
  return 'ghost';
}

export default async function CrmDealsPage() {
  const session = await getSession();
  let deals: AnyDeal[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_deals')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      deals = JSON.parse(JSON.stringify(docs)) as AnyDeal[];
    } catch (e) {
      console.error('Failed to load crm_deals:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Deals"
        subtitle="Track active opportunities through your sales pipelines."
        icon={Handshake}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/sales-crm/deals/new">
              <Plus className="h-4 w-4" /> New deal
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All deals</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Pipeline opportunities sorted by creation date.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Amount</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Probability %</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Expected Close</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load deals. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : deals.length > 0 ? (
                deals.map((deal, idx) => {
                  const id =
                    typeof deal._id === 'string'
                      ? deal._id
                      : (deal._id as any)?.toString?.() ?? String(idx);

                  // CrmDeal stores the deal name under `name`, not `title`
                  const title = deal.title ?? (deal as any).name ?? '—';

                  // Client may come from clientName or the account/contact name field
                  const client =
                    deal.clientName ??
                    (deal as any).accountName ??
                    (deal as any).contactName ??
                    '—';

                  const stage = deal.stage ?? (deal as any).stage ?? '—';
                  const status = deal.status ?? stage;

                  const expectedClose =
                    deal.expectedClose ?? (deal as any).closeDate;
                  const owner = deal.owner ?? (deal as any).ownerName ?? '—';

                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <Link
                          href={`/dashboard/crm/sales-crm/deals/${id}`}
                          className="hover:underline"
                        >
                          {title}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {client}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStageBadgeVariant(stage)}>
                          {stage}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[13px] text-zoru-ink">
                        {formatAmount(deal)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {deal.probability != null ? `${deal.probability}%` : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {formatDate(expectedClose)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {owner}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStageBadgeVariant(status)}>
                          {status}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No deals yet. Create your first deal to start tracking pipeline opportunities.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
