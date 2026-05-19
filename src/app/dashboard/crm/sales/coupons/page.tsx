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

type AnyCoupon = {
  _id?: { toString(): string } | string;
  code?: string;
  type?: string;
  value?: number;
  minCart?: number;
  maxUses?: number;
  usedCount?: number;
  validFrom?: string | Date;
  validTo?: string | Date;
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

function formatNumber(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

function formatValue(type: string | undefined, value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const t = (type || '').toLowerCase();
  if (t === 'percent' || t === 'percentage') return `${value}%`;
  return value.toLocaleString();
}

function formatValidity(
  from: string | Date | undefined,
  to: string | Date | undefined,
): string {
  const f = formatDate(from);
  const t = formatDate(to);
  if (f === '—' && t === '—') return '—';
  return `${f} → ${t}`;
}

export default async function SalesCouponsPage() {
  let coupons: AnyCoupon[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_coupons')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      coupons = JSON.parse(JSON.stringify(docs)) as AnyCoupon[];
    } catch (e) {
      console.error('Failed to load CRM coupons:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Coupons"
      subtitle="Create and track promo codes, BOGO offers and free-shipping vouchers."
      primaryAction={
        <Link href="/dashboard/crm/sales/coupons/new">
          <ZoruButton variant="outline">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New coupon
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All coupons</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Discount codes with usage caps, validity windows and redemption tracking.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Value</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Min cart</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Max uses</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Used</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Validity</ZoruTableHead>
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
                    Could not load coupons. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : coupons.length > 0 ? (
                coupons.map((c, idx) => {
                  const id =
                    typeof c._id === 'string'
                      ? c._id
                      : (c._id as any)?.toString?.() ?? String(idx);
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <EntityRowLink
                          href={`/dashboard/crm/sales/coupons/${id}`}
                          label={(c as any).code || 'Untitled coupon'}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {(c as any).type || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatValue((c as any).type, (c as any).value)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber((c as any).minCart)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber((c as any).maxUses)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber((c as any).usedCount)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatValidity((c as any).validFrom, (c as any).validTo)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(c.status)}>
                          {c.status || 'draft'}
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
                    No coupons yet. Create your first promo code to start running
                    campaigns.
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
