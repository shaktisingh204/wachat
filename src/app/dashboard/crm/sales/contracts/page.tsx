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
import { FileSignature,
  Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import Link from 'next/link';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyContract = {
  _id?: { toString(): string } | string;
  title?: string;
  partyB?: string;
  counterparty?: string;
  contractType?: string;
  status?: string;
  effectiveDate?: string | Date;
  expiryDate?: string | Date;
  esignProvider?: string;
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
  if (s === 'active' || s === 'completed' || s === 'signed') return 'success';
  if (s === 'paused' || s === 'draft') return 'ghost';
  if (s === 'cancelled' || s === 'voided' || s === 'past_due' || s === 'expired')
    return 'danger';
  return 'warning';
}

export default async function SalesContractsPage() {
  let contracts: AnyContract[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_contracts')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      contracts = JSON.parse(JSON.stringify(docs)) as AnyContract[];
    } catch (e) {
      console.error('Failed to load CRM contracts:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Contracts"
        subtitle="Draft, send, e-sign and track customer contracts in one place."
        icon={FileSignature}
        actions={
          <Link href="/dashboard/crm/sales/contracts/new">
            <ZoruButton variant="outline">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New contract
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All contracts</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Customer contracts, signatures and renewal tracking.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Counterparty</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Effective</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Expiry</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">E-sign</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load contracts. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : contracts.length > 0 ? (
                contracts.map((c, idx) => {
                  const id =
                    typeof c._id === 'string'
                      ? c._id
                      : c._id?.toString?.() ?? String(idx);
                  const counterparty =
                    (c as any).partyB || (c as any).counterparty || '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <Link
                          href={`/dashboard/crm/sales/contracts/${id}`}
                          className="hover:underline"
                        >
                          {c.title || 'Untitled contract'}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {counterparty}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {(c as any).contractType || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(c.status)}>
                          {c.status || 'draft'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((c as any).effectiveDate)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate((c as any).expiryDate)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {(c as any).esignProvider || '—'}
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
                    No contracts yet. Draft your first contract to track signatures and
                    renewals.
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
