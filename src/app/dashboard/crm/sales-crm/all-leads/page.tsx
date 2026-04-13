'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Plus, Users } from 'lucide-react';
import type { WithId } from 'mongodb';

import { getCrmLeads } from '@/app/actions/crm-leads.actions';
import type { CrmLead } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { cn } from '@/lib/utils';

const LEADS_PER_PAGE = 15;

function LeadsPageSkeleton() {
  return (
    <ClayCard>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="mt-4 h-96 w-full" />
    </ClayCard>
  );
}

function statusTone(status: string): 'green' | 'rose-soft' | 'red' | 'neutral' {
  const s = status?.toLowerCase() || '';
  if (s === 'qualified' || s === 'converted' || s === 'won') return 'green';
  if (s === 'contacted' || s === 'proposal sent' || s === 'negotiation') return 'rose-soft';
  if (s === 'unqualified' || s === 'lost') return 'red';
  return 'neutral';
}

export default function CrmAllLeadsPage() {
  const [leads, setLeads] = useState<WithId<CrmLead>[]>([]);
  const [isLoading, startTransition] = useTransition();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const { leads: data, total } = await getCrmLeads(
        currentPage,
        LEADS_PER_PAGE,
        searchQuery,
      );
      setLeads(data);
      setTotalPages(Math.ceil(total / LEADS_PER_PAGE));
    });
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  if (isLoading && leads.length === 0) return <LeadsPageSkeleton />;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="All Leads"
        subtitle="Manage your incoming leads and sales opportunities."
        icon={Users}
        actions={
          <Link
            href="/dashboard/crm/sales-crm/all-leads/new"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full bg-clay-obsidian px-4 text-[13px] font-medium text-white hover:bg-clay-obsidian-hover',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add New Lead
          </Link>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">Leads Directory</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              A list of all leads in your CRM.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
            <Input
              placeholder="Search by title, name, email, or company..."
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Lead Title</TableHead>
                <TableHead className="text-clay-ink-muted">Contact</TableHead>
                <TableHead className="text-clay-ink-muted">Company</TableHead>
                <TableHead className="text-clay-ink-muted">Stage</TableHead>
                <TableHead className="text-clay-ink-muted">Value</TableHead>
                <TableHead className="text-clay-ink-muted">Source</TableHead>
                <TableHead className="text-clay-ink-muted">Created</TableHead>
                <TableHead className="text-clay-ink-muted">Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={8}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : leads.length > 0 ? (
                leads.map((lead) => {
                  const stage = lead.stage || lead.status || '';
                  return (
                    <TableRow key={lead._id.toString()} className="border-clay-border">
                      <TableCell className="font-medium text-clay-ink">{lead.title}</TableCell>
                      <TableCell>
                        <div className="text-[13px] font-medium text-clay-ink">
                          {lead.contactName}
                        </div>
                        <div className="text-[11.5px] text-clay-ink-muted">{lead.email}</div>
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {lead.company || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <ClayBadge tone={statusTone(stage)}>{stage}</ClayBadge>
                      </TableCell>
                      <TableCell className="font-mono text-[13px] text-clay-ink">
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: lead.currency || 'INR',
                        }).format(lead.value)}
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {lead.source || 'N/A'}
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {lead.nextFollowUp
                          ? new Date(lead.nextFollowUp).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No leads found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
