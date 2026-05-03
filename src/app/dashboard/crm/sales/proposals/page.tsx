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
            <h2 className="text-[16px] font-semibold text-foreground">
              All Proposals
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {proposals.length} result{proposals.length === 1 ? '' : 's'} · Total{' '}
              {fmtCurrency(totalValue, proposals[0]?.currency)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or number…"
                className="h-9 w-56 rounded-lg border-border bg-card pl-8 text-[13px]"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as WsProposalStatus | 'all')}
            >
              <SelectTrigger className="h-9 w-36 rounded-lg border-border bg-card text-[13px]">
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

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Number</TableHead>
                <TableHead className="text-muted-foreground">Title</TableHead>
                <TableHead className="text-muted-foreground">Issued</TableHead>
                <TableHead className="text-muted-foreground">Valid Until</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-right text-muted-foreground">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : empty ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No proposals found.
                  </TableCell>
                </TableRow>
              ) : (
                proposals.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer border-border hover:bg-secondary"
                  >
                    <TableCell className="font-medium text-foreground">
                      <Link
                        href={`/dashboard/crm/sales/proposals/${p._id}`}
                        className="hover:underline"
                      >
                        {p.proposal_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground">
                      <Link
                        href={`/dashboard/crm/sales/proposals/${p._id}`}
                        className="hover:underline"
                      >
                        {p.title || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {fmtDate(p.issue_date)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {fmtDate(p.valid_until)}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={STATUS_TONE[p.status] || 'neutral'} dot>
                        {p.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
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
