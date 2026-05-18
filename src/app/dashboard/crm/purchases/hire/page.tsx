/**
 * Hire (vendor sourcing) list — `/dashboard/crm/purchases/hire`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.1).
 *
 * Server component. Reads from `crm_purchase_leads` (the legacy
 * collection that backs hire requests). The Rust DTO for the Hire
 * entity hasn't shipped yet, so this still talks to Mongo directly.
 *
 * Status against §1D.1: KPI strip + filters + bulk-bar + view-switcher
 * are deferred until the Hire entity gets a Rust BFF and a Rust-shape
 * list endpoint — same pattern as Hire on the customer side. The
 * list-shell-with-table composition matches the canonical bar.
 */

import { Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { HireListClient } from './_components/hire-list-client';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface HireRow {
  _id: string;
  title?: string;
  category?: string;
  vendorCandidate?: string;
  requiredBy?: string;
  estimatedBudget?: number;
  stage?: string;
  status?: string;
  owner?: string;
  createdAt?: string;
}

export default async function PurchaseHirePage() {
  const session = await getSession();
  let rows: HireRow[] = [];
  let loadError: string | null = null;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const docs = await db
        .collection('crm_purchase_leads')
        .find({
          userId: new ObjectId(session.user._id as string),
        } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      rows = (
        JSON.parse(JSON.stringify(docs)) as Array<HireRow & { _id: string }>
      ).map((d) => ({
        _id: String(d._id),
        title: d.title,
        category: d.category,
        vendorCandidate: d.vendorCandidate,
        requiredBy:
          typeof d.requiredBy === 'string'
            ? d.requiredBy
            : d.requiredBy
              ? String(d.requiredBy)
              : undefined,
        estimatedBudget: d.estimatedBudget,
        stage: d.stage,
        status: d.status,
        owner: d.owner,
        createdAt:
          typeof d.createdAt === 'string'
            ? d.createdAt
            : d.createdAt
              ? String(d.createdAt)
              : undefined,
      }));
    } catch (e) {
      console.error('Failed to load crm_purchase_leads:', e);
      loadError = 'Could not load hire requests.';
    }
  }

  return (
    <HireListClient
      rows={rows}
      error={loadError}
      newHref="/dashboard/crm/purchases/hire/new"
    />
  );
}
