import { Building2 } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  ZoruBadge,
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

type AnyAsset = {
  _id?: { toString(): string } | string;
  assetCode?: string;
  name?: string;
  category?: string;
  cost?: number;
  purchaseDate?: string | Date;
  status?: string;
  custodianId?: { toString(): string } | string;
  custodianName?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'won' || s === 'in_use') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (
    s === 'rejected' ||
    s === 'closed_lost' ||
    s === 'cancelled' ||
    s === 'high' ||
    s === 'critical' ||
    s === 'disposed' ||
    s === 'retired'
  )
    return 'danger';
  return 'warning';
}

function formatCost(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function FixedAssetsPage() {
  const session = await getSession();
  let assets: AnyAsset[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_fixed_assets')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      assets = JSON.parse(JSON.stringify(docs)) as AnyAsset[];
    } catch (e) {
      console.error('Failed to load crm_fixed_assets:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Fixed Assets"
        subtitle="Maintain a register of capital assets with depreciation and disposal tracking."
        icon={Building2}
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All fixed assets</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Capitalised assets owned by the business with custodian and status.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Asset code</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Cost</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Purchased</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Custodian</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load fixed assets. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : assets.length > 0 ? (
                assets.map((asset, idx) => {
                  const id =
                    typeof asset._id === 'string'
                      ? asset._id
                      : (asset._id as any)?.toString?.() ?? String(idx);
                  const custodian =
                    (asset as any).custodianName ||
                    (typeof asset.custodianId === 'string'
                      ? asset.custodianId
                      : (asset.custodianId as any)?.toString?.()) ||
                    '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {asset.assetCode || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {asset.name || 'Untitled asset'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {asset.category || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatCost(asset.cost as any)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(asset.purchaseDate)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(asset.status)}>
                          {asset.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{custodian}</ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No fixed assets yet. Capitalise a purchase to register your first asset.
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
