'use client';

/**
 * Client side of the Leads list — owns the search box, the table, and
 * the hard-delete confirmation dialog. Search input is debounced and
 * writes back to the URL so the server component re-fetches.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { deleteLeadAction } from '@/app/actions/crm/leads.actions';
import type { CrmLeadDoc } from '@/lib/rust-client/crm-leads';

interface LeadListClientProps {
  leads: CrmLeadDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fullName(l: CrmLeadDoc): string {
  return [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed';
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function LeadListClient({
  leads,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: LeadListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmLeadDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const name = fullName(pendingDelete);
    startDelete(async () => {
      const res = await deleteLeadAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${name} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, company…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Contact</ZoruTableHead>
            <ZoruTableHead>Company / Title</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Source</ZoruTableHead>
            <ZoruTableHead>Value</ZoruTableHead>
            <ZoruTableHead>Created</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {leads.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                {initialQuery ? 'No leads match this search.' : 'No leads yet — click "New lead" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            leads.map((lead) => {
              const id = String(lead._id);
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/leads/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {fullName(lead)}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    <div className="flex flex-col">
                      {lead.email ? <span>{lead.email}</span> : null}
                      {lead.phone ? <span>{lead.phone}</span> : null}
                      {!lead.email && !lead.phone ? <span>—</span> : null}
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    <div className="flex flex-col">
                      {lead.company ? <span>{lead.company}</span> : null}
                      {lead.title ? <span>{lead.title}</span> : null}
                      {!lead.company && !lead.title ? <span>—</span> : null}
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {lead.status?.name ? (
                      <ZoruBadge variant="outline">{lead.status.name}</ZoruBadge>
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {lead.attribution?.source || lead.subSource || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {fmtMoney(lead.estimatedValue, lead.currency)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(lead.createdAt || lead.audit?.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/leads/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(lead)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete lead?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes <strong>{pendingDelete ? fullName(pendingDelete) : ''}</strong>{' '}
              from the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
