import { Layers } from 'lucide-react';
import { ObjectId } from 'mongodb';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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

type AnyBom = {
  _id?: { toString(): string } | string;
  bomNo?: string;
  finishedGoodId?: { toString(): string } | string;
  finishedGoodName?: string;
  components?: unknown[];
  outputQty?: number;
  effectiveDate?: string | Date;
  status?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return String(value);
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'closed') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'npa' || s === 'cancelled' || s === 'expired' || s === 'lost') return 'danger';
  return 'warning';
}

function shortId(id: string): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 6)}…${id.slice(-2)}` : id;
}

export default async function BomPage() {
  const session = await getSession();
  let boms: AnyBom[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_boms')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      boms = JSON.parse(JSON.stringify(docs)) as AnyBom[];
    } catch (e) {
      console.error('Failed to load crm_boms:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Bill of Materials (BOM)"
        subtitle="Recipes that map a finished good to its component inputs and output quantity."
        icon={Layers}
        actions={
          <ZoruButton variant="outline" size="sm">
            New BOM
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All BOMs</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Active and draft bills of materials with their effective dates.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">BOM no.</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Finished good</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Components</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Output qty</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Effective</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load bills of materials. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : boms.length > 0 ? (
                boms.map((bom, idx) => {
                  const idStr =
                    typeof bom._id === 'string'
                      ? bom._id
                      : (bom._id as any)?.toString?.() ?? String(idx);
                  const bomNo = (bom as any).bomNo || shortId(idStr);
                  const finishedGood =
                    (bom as any).finishedGoodName ||
                    (typeof bom.finishedGoodId === 'string'
                      ? bom.finishedGoodId
                      : (bom.finishedGoodId as any)?.toString?.()) ||
                    '—';
                  const componentsArr = (bom as any).components;
                  const componentsCount = Array.isArray(componentsArr) ? componentsArr.length : 0;
                  return (
                    <ZoruTableRow key={idStr} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">{bomNo}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{finishedGood}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{componentsCount}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber((bom as any).outputQty)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((bom as any).effectiveDate)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(bom.status)}>
                          {bom.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No bills of materials yet. Define a BOM to start manufacturing.
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
