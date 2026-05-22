'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  Input,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { deleteDealAction } from '@/app/actions/crm/deals.actions';
import type { CrmDealDoc } from '@/lib/rust-client/crm-deals';

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'outline'> = {
  open: 'outline',
  won: 'success',
  lost: 'danger',
  abandoned: 'warning',
};

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

interface Props {
  deals: CrmDealDoc[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

export function DealListClient({ deals, page, limit, total, hasMore, initialQuery, error }: Props) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmDealDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

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
    const title = pendingDelete.title || 'Deal';
    startDelete(async () => {
      const res = await deleteDealAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${title} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Title</ZoruTableHead>
            <ZoruTableHead>Counter-party</ZoruTableHead>
            <ZoruTableHead>Owner</ZoruTableHead>
            <ZoruTableHead>Amount</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Expected close</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {deals.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                {initialQuery ? 'No deals match this search.' : 'No deals yet — click "New deal" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            deals.map((deal) => {
              const id = String(deal._id);
              const partyEntity = deal.party?.kind === 'lead' ? 'lead' : 'client';
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link href={`/dashboard/crm/deals/${id}`} className="font-medium text-zoru-ink hover:underline">
                      {deal.title}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {deal.party?.id ? (
                      <EntityPickerChip entity={partyEntity} id={deal.party.id} />
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {deal.ownerId ? <EntityPickerChip entity="user" id={deal.ownerId} /> : '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="tabular-nums text-[12.5px] text-zoru-ink">
                    {fmtMoney(deal.amount, deal.currency)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {deal.status ? (
                      <Badge variant={STATUS_VARIANTS[deal.status] ?? 'outline'}>{deal.status}</Badge>
                    ) : (
                      '—'
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(deal.expectedClose)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/deals/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(deal)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </Table>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} total={total} />

      <ZoruAlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete deal?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes <strong>{pendingDelete?.title}</strong> from the database. The
              action cannot be undone.
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
    </Card>
  );
}
