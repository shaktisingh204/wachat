'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { CalendarClock, FileSignature, IndianRupee, Send, ShieldCheck, } from 'lucide-react';

/**
 * KPI strip for the Contracts list (§1D.1).
 *
 *  • Drafts        — status === 'draft'
 *  • Sent          — status === 'sent'
 *  • Signed        — status === 'signed'
 *  • Expiring 60d  — endDate within next 60 days, not terminated
 *  • Total value   — sum of value across non-terminated contracts
 */

import * as React from 'react';

export type ContractsKpiKey =
  | 'all'
  | 'draft'
  | 'sent'
  | 'signed'
  | 'expiring60';

interface ContractKpiInput {
  status?: string;
  endDate?: string | Date;
  value?: number;
}

export interface ContractsKpiCounts {
  draft: number;
  sent: number;
  signed: number;
  expiring60: number;
  totalValue: number;
}

export function computeContractKpis(
  rows: ContractKpiInput[],
): ContractsKpiCounts {
  const now = Date.now();
  const horizon = now + 60 * 24 * 60 * 60 * 1000;
  let draft = 0;
  let sent = 0;
  let signed = 0;
  let expiring60 = 0;
  let totalValue = 0;
  for (const c of rows) {
    const s = (c.status ?? '').toLowerCase();
    if (s === 'draft') draft += 1;
    else if (s === 'sent') sent += 1;
    else if (s === 'signed') signed += 1;
    if (s !== 'terminated' && c.endDate) {
      const t = new Date(c.endDate).getTime();
      if (Number.isFinite(t) && t >= now && t <= horizon) expiring60 += 1;
    }
    if (s !== 'terminated' && typeof c.value === 'number') {
      totalValue += c.value;
    }
  }
  return { draft, sent, signed, expiring60, totalValue };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface ContractsKpiStripProps {
  counts: ContractsKpiCounts;
  active: ContractsKpiKey;
  onPick: (next: ContractsKpiKey) => void;
}

export function ContractsKpiStrip({
  counts,
  active,
  onPick,
}: ContractsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Drafts"
        value={counts.draft.toLocaleString()}
        icon={<FileSignature className="h-4 w-4" />}
        active={active === 'draft'}
        onClick={() => onPick(active === 'draft' ? 'all' : 'draft')}
      />
      <KpiCard
        label="Sent"
        value={counts.sent.toLocaleString()}
        icon={<Send className="h-4 w-4" />}
        active={active === 'sent'}
        onClick={() => onPick(active === 'sent' ? 'all' : 'sent')}
      />
      <KpiCard
        label="Signed"
        value={counts.signed.toLocaleString()}
        icon={<ShieldCheck className="h-4 w-4" />}
        active={active === 'signed'}
        onClick={() => onPick(active === 'signed' ? 'all' : 'signed')}
      />
      <KpiCard
        label="Expiring 60d"
        value={counts.expiring60.toLocaleString()}
        icon={<CalendarClock className="h-4 w-4" />}
        active={active === 'expiring60'}
        onClick={() => onPick(active === 'expiring60' ? 'all' : 'expiring60')}
      />
      <KpiCard
        label="Total value"
        value={inr.format(counts.totalValue)}
        icon={<IndianRupee className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
        active ? 'rounded-[var(--st-radius-lg)] ring-1 ring-[var(--st-text)]' : '',
      ].join(' ')}
    >
      <StatCard label={label} value={value} icon={icon} />
    </button>
  );
}

export default ContractsKpiStrip;
