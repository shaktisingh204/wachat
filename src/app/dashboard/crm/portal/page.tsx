import { Button } from '@/components/zoruui';
import { ObjectId } from 'mongodb';
import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Skeleton } from '@/components/zoruui/skeleton';

import Link from 'next/link';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

import { PortalListClient } from './_components/portal-list-client';
import type { PortalUserRow } from './_components/portal-types';

type AnyPortalUser = {
  _id?: { toString(): string } | string;
  name?: string;
  email?: string;
  portalType?: string;
  type?: string;
  capabilities?: string[];
  linkedEntityId?: { toString(): string } | string;
  linkedEntityLabel?: string;
  lastLoginAt?: string | Date;
  status?: string;
  createdAt?: string | Date;
};

function toId(v: AnyPortalUser['_id'], fallback: string): string {
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

function toIdMaybe(v: AnyPortalUser['linkedEntityId']): string | undefined {
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

async function PortalListContainer() {
  let users: PortalUserRow[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      if (!session.user._id) throw new Error('Unauthorized');
      const userObjectId = new ObjectId(session.user._id);
      const docs = (await db
        .collection('crm_portal_users')
        .find({ userId: userObjectId } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()) as unknown as AnyPortalUser[];
      users = docs.map((u, idx) => ({
        _id: toId(u._id, String(idx)),
        name: u.name,
        email: u.email,
        portalType: u.portalType ?? u.type,
        capabilities: Array.isArray(u.capabilities) ? u.capabilities : [],
        linkedEntityId: toIdMaybe(u.linkedEntityId),
        linkedEntityLabel: u.linkedEntityLabel,
        lastLoginAt: toIso(u.lastLoginAt),
        status: u.status,
      }));
    } catch (e) {
      console.error('Failed to load CRM portal users:', e);
      loadError = true;
    }
  }

  return (
    <>
      {loadError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600 mb-4 animate-in fade-in-50">
          Could not load portal users. Please try again.
        </div>
      ) : null}
      <PortalListClient users={users} />
    </>
  );
}

function PortalListSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI Strip Skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
        <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
        <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
        <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
      </div>
      {/* Search & Filter Skeleton */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64 rounded-lg animate-pulse" />
        <Skeleton className="h-9 w-32 rounded-lg animate-pulse" />
        <Skeleton className="h-9 w-32 rounded-lg animate-pulse" />
        <Skeleton className="h-9 w-36 rounded-lg animate-pulse" />
      </div>
      {/* Table Skeleton */}
      <div className="rounded-xl border border-zoru-line bg-zoru-surface p-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full animate-pulse" />
          <Skeleton className="h-12 w-full animate-pulse" />
          <Skeleton className="h-12 w-full animate-pulse" />
          <Skeleton className="h-12 w-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default async function CustomerPortalPage() {
  return (
    <EntityListShell
      title="Customer Portal"
      subtitle="Self-service portal where customers see invoices, tickets and documents."
      primaryAction={
        <Link href="/dashboard/crm/portal/new">
          <Button variant="outline">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New portal user
          </Button>
        </Link>
      }
    >
      <Suspense fallback={<PortalListSkeleton />}>
        <PortalListContainer />
      </Suspense>
    </EntityListShell>
  );
}
