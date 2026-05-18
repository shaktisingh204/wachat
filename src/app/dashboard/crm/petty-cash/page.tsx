import { ZoruButton } from '@/components/zoruui';
import { Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

import { PettyCashListClient } from './_components/petty-cash-list-client';
import type { PettyCashRow } from './_components/petty-cash-types';

type AnyFloat = {
  _id?: { toString(): string } | string;
  branchId?: { toString(): string } | string;
  branchName?: string;
  custodianId?: { toString(): string } | string;
  custodianName?: string;
  openingBalance?: number;
  totalTopUps?: number;
  totalSpent?: number;
  balance?: number;
  topUpDueAt?: string | Date;
  pendingIous?: number;
  lastReconciledAt?: string | Date;
  lastToppedUpAt?: string | Date;
  status?: string;
  createdAt?: string | Date;
};

function toId(v: AnyFloat['_id'], fallback: string): string {
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

function toIdMaybe(v: AnyFloat['branchId']): string | undefined {
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

export default async function PettyCashPage() {
  const session = await getSession();
  let floats: PettyCashRow[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = (await db
        .collection('crm_petty_cash_floats')
        .find({ userId: userObjectId } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()) as unknown as AnyFloat[];
      floats = docs.map((f, idx) => ({
        _id: toId(f._id, String(idx)),
        branchId: toIdMaybe(f.branchId),
        branchName: f.branchName,
        custodianId: toIdMaybe(f.custodianId),
        custodianName: f.custodianName,
        openingBalance:
          typeof f.openingBalance === 'number' ? f.openingBalance : undefined,
        totalTopUps:
          typeof f.totalTopUps === 'number' ? f.totalTopUps : undefined,
        totalSpent:
          typeof f.totalSpent === 'number' ? f.totalSpent : undefined,
        balance: typeof f.balance === 'number' ? f.balance : undefined,
        topUpDueAt: toIso(f.topUpDueAt),
        pendingIous:
          typeof f.pendingIous === 'number' ? f.pendingIous : undefined,
        lastReconciledAt: toIso(f.lastReconciledAt),
        lastToppedUpAt: toIso(f.lastToppedUpAt),
        status: f.status,
        createdAt: toIso(f.createdAt),
      }));
    } catch (e) {
      console.error('Failed to load crm_petty_cash_floats:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Petty Cash"
      subtitle="Branch and employee cash floats with top-ups, spends and reconciliation."
      primaryAction={
        <ZoruButton variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/petty-cash/new">
            <Plus className="h-4 w-4" /> New float
          </Link>
        </ZoruButton>
      }
    >

      {loadError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          Could not load petty cash floats. Please try again.
        </div>
      ) : null}

      <PettyCashListClient floats={floats} />
    </EntityListShell>
  );
}
