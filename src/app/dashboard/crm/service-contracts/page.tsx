import { Plus, Wrench } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

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

type AnyAmc = {
  _id?: { toString(): string } | string;
  contractNo?: string;
  customerId?: { toString(): string } | string;
  customerName?: string;
  assetId?: { toString(): string } | string;
  assetName?: string;
  coverage?: string;
  frequency?: string;
  periodStart?: string | Date;
  periodEnd?: string | Date;
  status?: string;
  createdAt?: string | Date;
};

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatPeriod(start: string | Date | undefined, end: string | Date | undefined): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s === '—' && e === '—') return '—';
  return `${s} → ${e}`;
}

function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'closed') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'npa' || s === 'cancelled' || s === 'expired' || s === 'lost') return 'danger';
  return 'warning';
}

export default async function ServiceContractsPage() {
  const session = await getSession();
  let contracts: AnyAmc[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_amc_contracts')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      contracts = JSON.parse(JSON.stringify(docs)) as AnyAmc[];
    } catch (e) {
      console.error('Failed to load crm_amc_contracts:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Service Contracts (AMC)"
        subtitle="Annual maintenance contracts with coverage and visit frequency."
        icon={Wrench}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/service-contracts/new">
              <Plus className="h-4 w-4" /> New contract
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All service contracts</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            AMCs covering customer assets with scheduled service visits.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Contract no.</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Customer</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Asset</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Coverage</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Frequency</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
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
                    Could not load service contracts. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : contracts.length > 0 ? (
                contracts.map((c, idx) => {
                  const id =
                    typeof c._id === 'string'
                      ? c._id
                      : (c._id as any)?.toString?.() ?? String(idx);
                  const customer =
                    (c as any).customerName ||
                    (typeof c.customerId === 'string'
                      ? c.customerId
                      : (c.customerId as any)?.toString?.()) ||
                    '—';
                  const asset =
                    (c as any).assetName ||
                    (typeof c.assetId === 'string'
                      ? c.assetId
                      : (c.assetId as any)?.toString?.()) ||
                    '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {(c as any).contractNo || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{customer}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{asset}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {(c as any).coverage || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {(c as any).frequency || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatPeriod((c as any).periodStart, (c as any).periodEnd)}
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
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No service contracts yet. Create an AMC to start scheduling visits.
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
