'use client';
import { ZoruBadge, ZoruCard, ZoruInput, ZoruSkeleton, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, useZoruToast } from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Plus, Users, Building, LoaderCircle } from 'lucide-react';
import { convertLeadToAccount } from '@/app/actions/worksuite/conversions.actions';

import type { WithId } from 'mongodb';

import { getCrmLeads } from '@/app/actions/crm-leads.actions';
import type { CrmLead } from '@/lib/definitions';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { cn } from '@/lib/utils';

const LEADS_PER_PAGE = 15;

function LeadsPageSkeleton() {
  return (
    <ZoruCard>
      <ZoruSkeleton className="h-6 w-48" />
      <ZoruSkeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <ZoruSkeleton className="h-10 w-64" />
        <ZoruSkeleton className="h-10 w-48" />
      </div>
      <ZoruSkeleton className="mt-4 h-96 w-full" />
    </ZoruCard>
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
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const { toast } = useZoruToast();

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
              'inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/90',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add New Lead
          </Link>
        }
      />

      <ZoruCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">Leads Directory</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              A list of all leads in your CRM.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <ZoruInput
              placeholder="Search by title, name, email, or company..."
              className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Lead Title</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Contact</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Company</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Stage</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Value</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Source</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Created</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Follow-up</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground w-[160px]">Action</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-border">
                    <ZoruTableCell colSpan={9}>
                      <ZoruSkeleton className="h-10 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : leads.length > 0 ? (
                leads.map((lead) => {
                  const stage = lead.stage || lead.status || '';
                  return (
                    <ZoruTableRow key={lead._id.toString()} className="border-border">
                      <ZoruTableCell className="font-medium text-foreground">{lead.title}</ZoruTableCell>
                      <ZoruTableCell>
                        <div className="text-[13px] font-medium text-foreground">
                          {lead.contactName}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground">{lead.email}</div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-foreground">
                        {lead.company || 'N/A'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={(statusTone(stage)) as any}>{stage}</ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[13px] text-foreground">
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: lead.currency || 'INR',
                        }).format(lead.value)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-foreground">
                        {lead.source || 'N/A'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-foreground">
                        {lead.nextFollowUp
                          ? new Date(lead.nextFollowUp).toLocaleDateString()
                          : 'N/A'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {(lead.status as string) === 'Converted' ? (
                          <span className="text-[11.5px] text-muted-foreground">
                            Converted
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={convertingId === lead._id.toString()}
                            onClick={async () => {
                              const id = lead._id.toString();
                              setConvertingId(id);
                              const res = await convertLeadToAccount(id);
                              setConvertingId(null);
                              if (res.success) {
                                toast({ title: 'Converted to Account' });
                                fetchData();
                              } else {
                                toast({
                                  variant: 'destructive',
                                  title: 'Conversion failed',
                                  description: res.error,
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:bg-muted disabled:opacity-60"
                          >
                            {convertingId === lead._id.toString() ? (
                              <LoaderCircle className="h-3 w-3 animate-spin" />
                            ) : (
                              <Building className="h-3 w-3" />
                            )}
                            Convert to Account
                          </button>
                        )}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No leads found.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
