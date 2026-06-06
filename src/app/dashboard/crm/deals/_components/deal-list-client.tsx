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
} from '@/components/sabcrm/20ui/compat';
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
  LayoutList,
  Columns,
  GripVertical
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { deleteDealAction, saveDealAction } from '@/app/actions/crm/deals.actions';
import type { CrmDealDoc } from '@/lib/rust-client/crm-deals';

import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

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
  stages?: string[];
}

export function DealListClient({ deals: initialDeals, page, limit, total, hasMore, initialQuery, error, stages = [] }: Props) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmDealDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const [view, setView] = React.useState<'list' | 'kanban'>('list');
  const [deals, setDeals] = React.useState(initialDeals);

  // Sync deals when initialDeals changes (e.g. pagination or server refresh)
  React.useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP(() => {
    if (view === 'kanban') {
      gsap.from('.kanban-card', {
        y: 20,
        opacity: 0,
        stagger: 0.05,
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }, { dependencies: [view], scope: containerRef });

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

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    if (!dealId) return;

    const dealIndex = deals.findIndex(d => String(d._id) === dealId);
    if (dealIndex === -1) return;

    const deal = deals[dealIndex];
    if (deal.stageId === newStage) return;

    // Optimistic update
    const prevDeals = [...deals];
    const newDeals = [...deals];
    newDeals[dealIndex] = { ...deal, stageId: newStage };
    setDeals(newDeals);
    
    // GSAP animation for dropped card
    const animateDrop = contextSafe(() => {
      const cardEl = document.getElementById(`deal-card-${dealId}`);
      if (cardEl) {
        gsap.fromTo(cardEl, { scale: 1.05, opacity: 0.8 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' });
      }
    });
    // Call animation on next tick so DOM is updated
    setTimeout(animateDrop, 10);

    // Call server action (fake form data for saveDealAction)
    const fd = new FormData();
    fd.append('_id', dealId);
    fd.append('title', deal.title);
    fd.append('pipelineId', deal.pipelineId || '');
    fd.append('stageId', newStage);
    fd.append('ownerId', deal.ownerId || '');
    fd.append('amount', deal.amount != null ? String(deal.amount) : '');
    fd.append('expectedClose', deal.expectedClose ? deal.expectedClose.substring(0, 10) : '');
    fd.append('partyKind', deal.party?.kind || '');
    fd.append('partyId', deal.party?.id || '');

    const res = await saveDealAction(null, fd);
    if (res.error) {
      toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
      setDeals(prevDeals); // revert on error
    } else {
      toast({ title: 'Deal moved', description: `${deal.title} moved to ${newStage}.` });
      router.refresh();
    }
  };

  return (
    <Card className="overflow-hidden p-0" ref={containerRef}>
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={view === 'kanban' ? 'default' : 'outline'}
            onClick={() => setView('kanban')}
            title="Kanban view"
          >
            <Columns className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      {view === 'list' ? (
        <>
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Title</ZoruTableHead>
                <ZoruTableHead>Counter-party</ZoruTableHead>
                <ZoruTableHead>Owner</ZoruTableHead>
                <ZoruTableHead>Stage</ZoruTableHead>
                <ZoruTableHead>Amount</ZoruTableHead>
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
                      <ZoruTableCell>
                        <Badge variant="outline">{deal.stageId || 'Unknown'}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="tabular-nums text-[12.5px] text-zoru-ink">
                        {fmtMoney(deal.amount, deal.currency)}
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
        </>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-4 min-h-[500px] bg-zoru-surface">
          {stages.length === 0 && (
            <div className="w-full text-center text-zoru-ink-muted p-4">No stages defined for Kanban view.</div>
          )}
          {stages.map((stage) => {
            const columnDeals = deals.filter(d => d.stageId === stage || (!d.stageId && stage === stages[0]));
            return (
              <div 
                key={stage} 
                className="flex-shrink-0 w-80 bg-zoru-background rounded-lg border border-zoru-line flex flex-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className="p-3 border-b border-zoru-line bg-zoru-surface font-semibold text-zoru-ink text-sm flex justify-between items-center rounded-t-lg">
                  <span>{stage}</span>
                  <Badge variant="outline" className="text-xs font-normal">{columnDeals.length}</Badge>
                </div>
                <div className="p-2 flex-1 overflow-y-auto space-y-2">
                  {columnDeals.map((deal) => {
                    const id = String(deal._id);
                    return (
                      <div
                        id={`deal-card-${id}`}
                        key={id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, id)}
                        className="kanban-card group cursor-grab active:cursor-grabbing bg-zoru-surface border border-zoru-line rounded-md p-3 shadow-sm hover:shadow-md transition-shadow relative"
                      >
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4 text-zoru-ink-muted" />
                        </div>
                        <Link href={`/dashboard/crm/deals/${id}`} className="font-medium text-zoru-ink hover:underline block mb-1">
                          {deal.title}
                        </Link>
                        <div className="text-xs text-zoru-ink-muted mb-2">
                          {deal.party?.id ? (
                            <EntityPickerChip entity={deal.party.kind === 'lead' ? 'lead' : 'client'} id={deal.party.id} />
                          ) : (
                            'No counter-party'
                          )}
                        </div>
                        <div className="flex justify-between items-end mt-3">
                          <span className="tabular-nums font-semibold text-sm text-zoru-ink">
                            {fmtMoney(deal.amount, deal.currency)}
                          </span>
                          <span className="text-[11px] text-zoru-ink-muted">
                            {fmtDate(deal.expectedClose)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
