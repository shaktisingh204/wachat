import { Handshake, Plus } from 'lucide-react';
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

type AnyHire = {
  _id?: { toString(): string } | string;
  title?: string;
  category?: string;
  vendorCandidate?: string;
  requiredBy?: string | Date;
  quantity?: number;
  estimatedBudget?: number;
  stage?: string;
  owner?: string;
  status?: string;
  createdAt?: string | Date;
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(v: number | undefined): string {
  if (typeof v !== 'number' || isNaN(v)) return '—';
  return inr.format(v);
}

function formatDate(v: string | Date | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function stageVariant(stage?: string): 'ghost' | 'warning' | 'success' | 'danger' {
  switch ((stage || '').toLowerCase()) {
    case 'awarded':
      return 'success';
    case 'negotiating':
    case 'quotes_received':
      return 'warning';
    case 'closed_lost':
      return 'danger';
    default:
      return 'ghost';
  }
}

export default async function PurchaseHirePage() {
  const session = await getSession();
  let hires: AnyHire[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const docs = await db
        .collection('crm_purchase_leads')
        .find({ userId: new ObjectId(session.user._id as string) } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      hires = JSON.parse(JSON.stringify(docs)) as AnyHire[];
    } catch (e) {
      console.error('Failed to load crm_purchase_leads:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Vendor Hire & Services"
        subtitle="Track vendor hiring requests, bids, approvals, and onboarding from sourcing to award."
        icon={Handshake}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/purchases/hire/new">
              <Plus className="h-4 w-4" /> New hire request
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All hire requests</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Purchase leads for services, contractors, and vendor sourcing.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Vendor Candidate</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Required By</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Budget</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load hire requests. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : hires.length > 0 ? (
                hires.map((hire, idx) => {
                  const id =
                    typeof hire._id === 'string'
                      ? hire._id
                      : (hire._id as any)?.toString?.() ?? String(idx);
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        {hire.title || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {hire.category || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {hire.vendorCandidate || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(hire.requiredBy)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatMoney(hire.estimatedBudget)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={stageVariant(hire.stage)}>
                          {hire.stage || 'sourcing'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {hire.owner || '—'}
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
                    No hire requests yet. Create one to start tracking vendor sourcing.
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
