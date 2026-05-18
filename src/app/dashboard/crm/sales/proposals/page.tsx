'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  LoaderCircle,
  LayoutTemplate,
  Search,
  } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { getProposals } from '@/app/actions/worksuite/proposals.actions';
import type {
  WsProposal,
  WsProposalStatus,
} from '@/lib/worksuite/proposals-types';
import { WS_PROPOSAL_STATUSES } from '@/lib/worksuite/proposals-types';

type ProposalRow = WsProposal & { _id: string };

type BadgeVariant = 'ghost' | 'warning' | 'success' | 'danger';

const STATUS_VARIANT: Record<WsProposalStatus, BadgeVariant> = {
  draft: 'ghost',
  sent: 'warning',
  accepted: 'success',
  declined: 'danger',
  expired: 'danger',
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
              <ZoruButton variant="outline">
                <LayoutTemplate className="h-4 w-4" strokeWidth={1.75} />
                Templates
              </ZoruButton>
            </Link>
            <Link href="/dashboard/crm/sales/proposals/new">
              <ZoruButton>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                New Proposal
              </ZoruButton>
            </Link>
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">
              All Proposals
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {proposals.length} result{proposals.length === 1 ? '' : 's'} · Total{' '}
              {fmtCurrency(totalValue, proposals[0]?.currency)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <ZoruInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or number…"
                leadingSlot={<Search />}
                className="w-56"
              />
            </div>
            <ZoruSelect
              value={status}
              onValueChange={(v) => setStatus(v as WsProposalStatus | 'all')}
            >
              <ZoruSelectTrigger className="w-36">
                <ZoruSelectValue placeholder="All statuses" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                {WS_PROPOSAL_STATUSES.map((s) => (
                  <ZoruSelectItem key={s} value={s}>
                    {s}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Number</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Issued</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Valid Until</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Total</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={6} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : empty ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No proposals found.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                proposals.map((p) => (
                  <ZoruTableRow
                    key={p._id}
                    className="cursor-pointer border-zoru-line hover:bg-zoru-surface-2"
                  >
                    <ZoruTableCell className="text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/sales/proposals/${p._id}`}
                        className="hover:underline"
                      >
                        {p.proposal_number}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/sales/proposals/${p._id}`}
                        className="hover:underline"
                      >
                        {p.title || '—'}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {fmtDate(p.issue_date)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {fmtDate(p.valid_until)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={STATUS_VARIANT[p.status] || 'ghost'}>
                        {p.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink">
                      {fmtCurrency(p.total || 0, p.currency)}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
