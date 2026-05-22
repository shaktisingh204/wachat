'use client';

import { StatCard } from '@/components/zoruui';
import { CheckCircle2, FileEdit, Hourglass, PackageCheck, PackageOpen, } from 'lucide-react';

/**
 * <PurchaseOrdersKpiStrip> — KPI strip for the canonical PO list.
 *
 * 5 cards: Draft · Awaiting approval · Approved · Partial received ·
 * Closed. Each card is clickable so users can pivot the list filter
 * from a KPI. Mirrors `<InvoicesKpiStrip>` exactly.
 */

import * as React from 'react';

import type { PurchaseOrderKpiSummary } from '@/app/actions/crm/purchase-orders.kpis';

import type { PurchaseOrderPresetKey } from './types';

interface PurchaseOrdersKpiStripProps {
  kpi: PurchaseOrderKpiSummary;
  active?: PurchaseOrderPresetKey | null;
  onSelect: (preset: PurchaseOrderPresetKey) => void;
}

export function PurchaseOrdersKpiStrip({
  kpi,
  active,
  onSelect,
}: PurchaseOrdersKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'drafts'}
        onClick={() => onSelect('drafts')}
        ariaLabel="Show draft purchase orders"
      >
        <StatCard
          label="Draft"
          value={kpi.draftCount.toLocaleString()}
          period="not yet submitted"
          icon={<FileEdit />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'my-pending-approval'}
        onClick={() => onSelect('my-pending-approval')}
        ariaLabel="Show POs awaiting approval"
      >
        <StatCard
          label="Awaiting approval"
          value={kpi.awaitingApprovalCount.toLocaleString()}
          period="pending review"
          icon={<Hourglass />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'all-open'}
        onClick={() => onSelect('all-open')}
        ariaLabel="Show approved POs"
      >
        <StatCard
          label="Approved"
          value={kpi.approvedCount.toLocaleString()}
          period="approved / sent"
          icon={<CheckCircle2 />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'all-open'}
        onClick={() => onSelect('all-open')}
        ariaLabel="Show partially received POs"
      >
        <StatCard
          label="Partial received"
          value={kpi.partialCount.toLocaleString()}
          period="some lines received"
          icon={<PackageOpen />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'closed-30d'}
        onClick={() => onSelect('closed-30d')}
        ariaLabel="Show closed purchase orders"
      >
        <StatCard
          label="Closed"
          value={kpi.closedCount.toLocaleString()}
          period="received / closed"
          icon={<PackageCheck />}
        />
      </KpiButton>
    </div>
  );
}

function KpiButton({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={Boolean(active)}
      className={[
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
