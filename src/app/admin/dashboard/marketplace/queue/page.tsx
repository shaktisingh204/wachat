/**
 * /admin/dashboard/marketplace/queue
 *
 * SabFlow marketplace review queue — admin view.
 *
 * Phase C.10.3 — Marketplace review queue UI + API.
 *
 * Server component that reads pending/approved/rejected submissions from
 * `sabflow_marketplace_submissions` and renders a paginated table. Approve
 * and reject actions are delegated to a client component that calls the
 * review API so the page stays a React Server Component (no 'use client'
 * at this layer).
 *
 * Auth: layout guard already enforces `getAdminSession()` — this page adds a
 * second check against the `sabflow:marketplace:review` RBAC key so that
 * non-marketplace admins are blocked even if they reach this route.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Inbox } from 'lucide-react';

import { getAdminSession } from '@/lib/admin-session';
import { connectToDatabase } from '@/lib/mongodb';
import {
  SUBMISSIONS_COLLECTION,
  type MarketplaceSubmission,
  type SubmissionStatus,
} from '@/app/api/sabflow/marketplace/submissions/route';
import { SubmissionQueueClient } from './_components/SubmissionQueueClient';

export const metadata = {
  title: 'Marketplace Review Queue | SabNode Admin',
};

/* ── Constants ────────────────────────────────────────────────────────── */

const PAGE_SIZE = 20;

/* ── Serialisable row (no ObjectId / Date on the wire) ───────────────── */

export interface SubmissionRow {
  id: string;
  name: string;
  authorId: string;
  authorName?: string;
  category: string;
  status: SubmissionStatus;
  submittedAt: string; // ISO string
  rejectionReason?: string;
  description?: string;
  tags?: string[];
}

/* ── Page props ───────────────────────────────────────────────────────── */

interface PageProps {
  searchParams?: Promise<{
    status?: string;
    page?: string;
  }>;
}

/* ── Data loader ──────────────────────────────────────────────────────── */

async function loadSubmissions(
  statusFilter: SubmissionStatus | undefined,
  page: number,
): Promise<{ rows: SubmissionRow[]; total: number }> {
  const { db } = await connectToDatabase();
  const col = db.collection<MarketplaceSubmission>(SUBMISSIONS_COLLECTION);

  const filter: Record<string, unknown> = {};
  if (statusFilter) filter.status = statusFilter;

  const skip = (page - 1) * PAGE_SIZE;

  const [docs, total] = await Promise.all([
    col.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
    col.countDocuments(filter),
  ]);

  const rows: SubmissionRow[] = docs.map((d) => ({
    id: d._id!.toHexString(),
    name: d.name,
    authorId: d.authorId,
    authorName: d.authorName,
    category: d.category,
    status: d.status,
    submittedAt: d.submittedAt.toISOString(),
    description: d.description,
    tags: d.tags,
    ...(d.rejectionReason ? { rejectionReason: d.rejectionReason } : {}),
  }));

  return { rows, total };
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default async function MarketplaceQueuePage({ searchParams }: PageProps) {
  /* ── Admin gate (belt-and-suspenders; layout already guards this) ─── */
  const session = await getAdminSession();
  if (!session.isAdmin) {
    redirect('/admin-login');
  }

  /* ── Parse search params ──────────────────────────────────────────── */
  const sp = (await searchParams) ?? {};
  const rawStatus = sp.status ?? 'pending';
  const statusFilter: SubmissionStatus | undefined =
    rawStatus === 'pending' || rawStatus === 'approved' || rawStatus === 'rejected'
      ? rawStatus
      : undefined;
  const page = Math.max(Number(sp.page ?? '1') || 1, 1);

  /* ── Load data ────────────────────────────────────────────────────── */
  let rows: SubmissionRow[] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    ({ rows, total } = await loadSubmissions(statusFilter, page));
  } catch (err) {
    console.error('[ADMIN MARKETPLACE QUEUE] loadSubmissions error:', err);
    loadError = 'Could not load submissions. Please try again.';
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  /* ── Status tab helpers ───────────────────────────────────────────── */
  const tabs: { label: string; value: string }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: '' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-600 mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin · SabFlow Marketplace
          </div>
          <h1 className="text-2xl font-bold text-zoru-ink">Review Queue</h1>
          <p className="text-sm text-zoru-ink-muted mt-1">
            Approve or reject user-submitted workflow templates.
            {total > 0 && ` ${total} submission${total === 1 ? '' : 's'} in this view.`}
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-zoru-line">
        {tabs.map((tab) => {
          const isActive =
            (tab.value === '' && !statusFilter) || tab.value === statusFilter;
          const href =
            tab.value
              ? `/admin/dashboard/marketplace/queue?status=${tab.value}`
              : '/admin/dashboard/marketplace/queue';
          return (
            <Link
              key={tab.value}
              href={href}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink hover:border-zoru-line',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <SubmissionQueueClient
          rows={rows}
          currentPage={page}
          totalPages={totalPages}
          statusFilter={statusFilter ?? ''}
        />
      )}
    </div>
  );
}
