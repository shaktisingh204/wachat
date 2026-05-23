import { Button } from '@/components/zoruui';
import { Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

import { LoansListClient } from './_components/loans-list-client';
import type { LoanRow } from './_components/loans-types';

type AnyLoan = {
  _id?: { toString(): string } | string;
  type?: string;
  borrowerId?: { toString(): string } | string;
  borrowerName?: string;
  borrowerType?: string;
  principal?: number;
  interestRate?: number;
  tenureMonths?: number;
  emi?: number;
  outstanding?: number;
  npa?: boolean;
  status?: string;
  nextPaymentAt?: string | Date;
  createdAt?: string | Date;
};

function toId(v: AnyLoan['_id'], fallback: string): string {
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

function toIdMaybe(v: AnyLoan['borrowerId']): string | undefined {
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

export default async function LoansPage() {
  const session = await getSession();
  let loans: LoanRow[] = [];

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = (await db
        .collection('crm_loans')
        .find({ userId: userObjectId } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()) as unknown as AnyLoan[];
      loans = docs.map((l, idx) => ({
        _id: toId(l._id, String(idx)),
        type: l.type,
        borrowerId: toIdMaybe(l.borrowerId),
        borrowerName: l.borrowerName,
        borrowerType: l.borrowerType,
        principal:
          typeof l.principal === 'number' ? l.principal : undefined,
        interestRate:
          typeof l.interestRate === 'number' ? l.interestRate : undefined,
        tenureMonths:
          typeof l.tenureMonths === 'number' ? l.tenureMonths : undefined,
        emi: typeof l.emi === 'number' ? l.emi : undefined,
        outstanding:
          typeof l.outstanding === 'number' ? l.outstanding : undefined,
        npa: Boolean(l.npa),
        status: l.status,
        nextPaymentAt: toIso(l.nextPaymentAt),
        createdAt: toIso(l.createdAt),
      }));
    } catch (e) {
      console.error('Failed to load crm_loans:', e);
      throw new Error('Failed to load crm_loans data');
    }
  }

  return (
    <EntityListShell
      title="Loans & Advances"
      subtitle="Employee advances, customer and vendor loans with EMI and NPA tracking."
      primaryAction={
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/loans/new">
            <Plus className="h-4 w-4" /> New loan
          </Link>
        </Button>
      }
    >
      <LoansListClient loans={loans} />
    </EntityListShell>
  );
}
