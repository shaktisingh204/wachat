import { Button } from '@/components/sabcrm/20ui/compat';
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

import React from 'react';

async function PettyCashContent() {
  const session = await getSession();
  let floats: PettyCashRow[] = [];

  if (session?.user?._id) {
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
  }

  return <PettyCashListClient floats={floats} />;
}

export default function PettyCashPage() {
  return (
    <EntityListShell
      title="Petty Cash"
      subtitle="Branch and employee cash floats with top-ups, spends and reconciliation."
      primaryAction={
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/petty-cash/new">
            <Plus className="h-4 w-4" /> New float
          </Link>
        </Button>
      }
    >
      <React.Suspense fallback={<div className="h-64 w-full animate-pulse bg-[var(--st-bg-muted)] rounded-md" />}>
        <PettyCashContent />
      </React.Suspense>
    </EntityListShell>
  );
}
