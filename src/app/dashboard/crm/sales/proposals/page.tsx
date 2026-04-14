'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  LoaderCircle,
  LayoutTemplate,
  Search,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { getProposals } from '@/app/actions/worksuite/proposals.actions';
import type {
  WsProposal,
  WsProposalStatus,
} from '@/lib/worksuite/proposals-types';
import { WS_PROPOSAL_STATUSES } from '@/lib/worksuite/proposals-types';

type ProposalRow = WsProposal & { _id: string };

type BadgeTone = 'neutral' | 'amber' | 'green' | 'red' | 'blue';

const STATUS_TONE: Record<WsProposalStatus, BadgeTone> = {
  draft: 'neutral',
  sent: 'amber',
  accepted: 'green',
  declined: 'red',
  expired: 'red',
};

function fmtCurrency(value: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(value || 0);
  } catch {
    return `${currency || ''} ${(value || 0).toFixed(2)}`;
  }
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [status, setStatus] = useState<WsProposalStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => {
    startLoading(async () => {
      const rows = await getProposals({
        status: status === 'all' ? undefined : status,
        query: query.trim() || undefined,
      });
      setProposals(rows);
    });
  }, [status, query]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const empty = !isLoading && proposals.length === 0;
  const totalValue = useMemo(
    () => proposals.reduce((s, p) => s + Number(p.total || 0), 0),
    [proposals],
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Proposals"
        subtitle="Create, send, and track sales proposals with e-signature."
        icon={FileText}
        actions={
          <>
            <Link href="/dashboard/crm/sales/proposals/templates">
              <ClayButton
                variant="pill"
                leading={<LayoutTemplate className="h-4 w-4" strokeWidth={1.75} />}
              >
                Templates
              </ClayButton>
            </Link>
            <Link href="/dashboard/crm/sales/proposals/new">
              <ClayButton
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              >
                New Proposal
              </ClayButton>
            </Link>
          </>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">
              All Proposals
            </h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              {proposals.length} result{proposals.length === 1 ? '' : 's'} · Total{' '}
              {fmtCurrency(totalValue, proposals[0]?.currency)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or number…"
                className="h-9 w-56 rounded-clay-md border-clay-border bg-clay-surface pl-8 text-[13px]"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as WsProposalStatus | 'all')}
            >
              <SelectTrigger className="h-9 w-36 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {WS_PROPOSAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Number</TableHead>
                <TableHead className="text-clay-ink-muted">Title</TableHead>
                <TableHead className="text-clay-ink-muted">Issued</TableHead>
                <TableHead className="text-clay-ink-muted">Valid Until</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-right text-clay-ink-muted">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" />
                  </TableCell>
                </TableRow>
              ) : empty ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No proposals found.
                  </TableCell>
                </TableRow>
              ) : (
                proposals.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer border-clay-border hover:bg-clay-surface-2"
                  >
                    <TableCell className="font-medium text-clay-ink">
                      <Link
                        href={`/dashboard/crm/sales/proposals/${p._id}`}
                        className="hover:underline"
                      >
                        {p.proposal_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      <Link
                        href={`/dashboard/crm/sales/proposals/${p._id}`}
                        className="hover:underline"
                      >
                        {p.title || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {fmtDate(p.issue_date)}
                    </TableCell>
                    <TableCell className="text-clay-ink">
                      {fmtDate(p.valid_until)}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={STATUS_TONE[p.status] || 'neutral'} dot>
                        {p.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-clay-ink">
                      {fmtCurrency(p.total || 0, p.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
