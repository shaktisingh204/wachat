import { Button } from '@/components/zoruui';
import { Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

import { ServiceContractsListClient } from './_components/service-contracts-list-client';
import type { ServiceContractRow } from './_components/service-contracts-types';

type AnyAmc = {
  _id?: { toString(): string } | string;
  contractNo?: string;
  customerId?: { toString(): string } | string;
  customerName?: string;
  technicianId?: { toString(): string } | string;
  technicianName?: string;
  assetId?: { toString(): string } | string;
  assetName?: string;
  coverage?: string;
  frequency?: string;
  periodStart?: string | Date;
  periodEnd?: string | Date;
  status?: string;
  renewalDue?: boolean;
  billedAmount?: number;
  value?: number;
};

function toId(v: AnyAmc['_id'], fallback: string): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toString' in v) {
    try {
      return v.toString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function toIdMaybe(v: AnyAmc['customerId']): string | undefined {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toString' in v) {
    try {
      return v.toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function toIso(v: string | Date | undefined | null): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export default async function ServiceContractsPage() {
  const session = await getSession();
  let contracts: ServiceContractRow[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = (await db
        .collection('crm_amc_contracts')
        .find({ userId: userObjectId } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()) as unknown as AnyAmc[];
      contracts = docs.map((c, idx) => ({
        _id: toId(c._id, String(idx)),
        contractNo: c.contractNo,
        customerId: toIdMaybe(c.customerId),
        customerName: c.customerName,
        technicianId: toIdMaybe(c.technicianId),
        technicianName: c.technicianName,
        coverage: c.coverage,
        frequency: c.frequency,
        periodStart: toIso(c.periodStart),
        periodEnd: toIso(c.periodEnd),
        status: c.status,
        renewalDue: Boolean(c.renewalDue),
        billedAmount:
          typeof c.billedAmount === 'number' ? c.billedAmount : undefined,
        value: typeof c.value === 'number' ? c.value : undefined,
      }));
    } catch (e) {
      console.error('Failed to load crm_amc_contracts:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Service Contracts (AMC)"
      subtitle="Annual maintenance contracts with coverage and visit frequency."
      primaryAction={
        <ZoruButton variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/service-contracts/new">
            <Plus className="h-4 w-4" /> New contract
          </Link>
        </ZoruButton>
      }
    >
      {loadError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          Could not load service contracts. Please try again.
        </div>
      ) : null}

      <ServiceContractsListClient contracts={contracts} />
    </EntityListShell>
  );
}
