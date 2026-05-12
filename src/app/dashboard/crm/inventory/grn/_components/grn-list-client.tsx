'use client';

/**
 * Client side of the GRN list — owns the search box, the table, and
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
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { deleteGrnAction } from '@/app/actions/crm/grns.actions';
import type { CrmGrnDoc } from '@/lib/rust-client/crm-grns';

interface GrnListClientProps {
  grns: CrmGrnDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusLabel(status?: string): string {
  if (!status) return '—';
  return status
    .split('_')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');
}

export function GrnListClient({
  grns,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: GrnListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmGrnDoc | null>(
    null,
  );
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
    const label = pendingDelete.grnNo || id;
    startDelete(async () => {
      const res = await deleteGrnAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
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
            placeholder="Search by GRN number…"
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
            <ZoruTableHead>GRN #</ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead>Vendor</ZoruTableHead>
            <ZoruTableHead>Warehouse</ZoruTableHead>
            <ZoruTableHead className="text-right">Lines</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {grns.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={7}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {initialQuery
                  ? 'No GRNs match this search.'
                  : 'No GRNs yet — click "New GRN" to record one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            grns.map((grn) => {
              const id = String(grn._id);
              const lineCount = Array.isArray(grn.items) ? grn.items.length : 0;
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/inventory/grn/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {grn.grnNo || id}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(grn.date)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {grn.vendorId ? (
                      <EntityPickerChip entity="vendor" id={grn.vendorId} />
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {grn.warehouseId ? (
                      <EntityPickerChip
                        entity="warehouse"
                        id={grn.warehouseId}
                      />
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                    {lineCount}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {grn.status ? (
                      <ZoruBadge variant="outline">
                        {statusLabel(
                          typeof grn.status === 'string' ? grn.status : undefined,
                        )}
                      </ZoruBadge>
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/inventory/grn/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(grn)}
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
            <ZoruAlertDialogTitle>Delete GRN?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{' '}
              <strong>{pendingDelete?.grnNo || ''}</strong> from the database.
              The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
