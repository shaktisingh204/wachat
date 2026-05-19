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
import {
  ObjectId } from 'mongodb';
import { Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import Link from 'next/link';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyGiftCard = {
  _id?: { toString(): string } | string;
  code?: string;
  issuedToId?: { toString(): string } | string;
  issuedToName?: string;
  value?: number;
  balance?: number;
  expiryDate?: string | Date;
  transferable?: boolean;
  status?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'redeemed' || s === 'won') return 'success';
  if (s === 'draft' || s === 'pending' || s === 'issued') return 'ghost';
  if (s === 'expired' || s === 'cancelled' || s === 'voided') return 'danger';
  return 'warning';
}

function formatAmount(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function SalesGiftCardsPage() {
  let cards: AnyGiftCard[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_gift_cards')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      cards = JSON.parse(JSON.stringify(docs)) as AnyGiftCard[];
    } catch (e) {
      console.error('Failed to load CRM gift cards:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Gift cards"
      subtitle="Issue, track and redeem gift cards with balance and expiry controls."
      primaryAction={
        <Link href="/dashboard/crm/sales/gift-cards/new">
          <ZoruButton variant="outline">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New gift card
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All gift cards</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Issued gift cards with current balances, expiry and transferability.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Issued to</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Value</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Balance</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Expiry</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Transferable</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load gift cards. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : cards.length > 0 ? (
                cards.map((card, idx) => {
                  const id =
                    typeof card._id === 'string'
                      ? card._id
                      : (card._id as any)?.toString?.() ?? String(idx);
                  const issuedTo =
                    (card as any).issuedToName ||
                    (typeof card.issuedToId === 'string'
                      ? card.issuedToId
                      : (card.issuedToId as any)?.toString?.()) ||
                    '—';
                  const transferable = (card as any).transferable;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <EntityRowLink
                          href={`/dashboard/crm/sales/gift-cards/${id}`}
                          label={(card as any).code || 'Untitled card'}
                          subtitle={issuedTo !== '—' ? issuedTo : undefined}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {issuedTo}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatAmount((card as any).value)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatAmount((card as any).balance)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((card as any).expiryDate)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {transferable === true
                          ? 'Yes'
                          : transferable === false
                            ? 'No'
                            : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(card.status)}>
                          {card.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No gift cards yet. Issue your first gift card to start tracking
                    redemptions.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
