'use client';

import { Badge, Card, Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import { Clock, Trophy } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { updateCrmDealStage } from '@/app/actions/crm-deals.actions';
import { statusToTone, StatusPill } from '@/components/crm/status-pill';
import type { DealListRow } from './types';

gsap.registerPlugin(Flip, useGSAP);

interface DealKanbanProps {
  deals: DealListRow[];
  stages: string[];
  currency: string;
}

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function DealKanban({ deals, stages, currency }: DealKanbanProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const flipStateRef = React.useRef<Flip.FlipState | null>(null);

  // Local mirror so we can optimistically move cards before the server confirms.
  const [board, setBoard] = React.useState<DealListRow[]>(deals);
  const [, startTransition] = React.useTransition();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  // Track pending updates to prevent "ghost deals" when rapidly moved and
  // the server re-renders stale data.
  const pendingRef = React.useRef<Set<string>>(new Set());
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const addPending = (id: string) => {
    pendingRef.current.add(id);
    setPending(new Set(pendingRef.current));
  };
  const removePending = (id: string) => {
    pendingRef.current.delete(id);
    setPending(new Set(pendingRef.current));
  };

  // Re-sync when the upstream `deals` prop changes (server refetch).
  // Preserves optimistic stage if the deal is currently pending a server response.
  React.useEffect(() => {
    setBoard((prevBoard) => {
      return deals.map((serverDeal) => {
        if (pendingRef.current.has(serverDeal._id)) {
          const optimisticDeal = prevBoard.find((p) => p._id === serverDeal._id);
          if (optimisticDeal) {
            return { ...serverDeal, stage: optimisticDeal.stage };
          }
        }
        return serverDeal;
      });
    });
  }, [deals]);

  useGSAP(() => {
    if (flipStateRef.current) {
      Flip.from(flipStateRef.current, {
        duration: 0.3,
        ease: 'power2.out',
        absolute: true,
      });
      flipStateRef.current = null;
    }
  }, { scope: containerRef, dependencies: [board] });

  const grouped = React.useMemo(() => {
    const map = new Map<string, DealListRow[]>();
    for (const s of stages) map.set(s, []);
    for (const d of board) {
      const key = d.stage ?? 'Untriaged';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [board, stages]);

  const columnTotal = (rows: DealListRow[]): number =>
    rows.reduce((sum, r) => sum + (typeof r.amount === 'number' ? r.amount : 0), 0);

  const handleDrop = (newStage: string, dealId: string) => {
    if (pending.has(dealId)) {
      setDraggingId(null);
      return;
    }

    const target = board.find((d) => d._id === dealId);
    if (!target || target.stage === newStage) {
      setDraggingId(null);
      return;
    }
    const oldStage = target.stage;

    flipStateRef.current = Flip.getState('.kanban-card');

    // Optimistic update
    setBoard((rows) =>
      rows.map((r) => (r._id === dealId ? { ...r, stage: newStage } : r)),
    );
    addPending(dealId);
    setDraggingId(null);

    startTransition(async () => {
      const res = await updateCrmDealStage(dealId, newStage);
      
      removePending(dealId);

      if (!res.success) {
        // Revert on failure
        flipStateRef.current = Flip.getState('.kanban-card');
        setBoard((rows) =>
          rows.map((r) => (r._id === dealId ? { ...r, stage: oldStage } : r)),
        );
        toast({
          title: 'Could not move deal',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: 'Stage updated',
        description: `Moved to ${newStage}.`,
      });
      // Refresh server data so KPI strip + table view stay in sync.
      router.refresh();
    });
  };

  return (
    <div ref={containerRef} className="flex w-full gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const rows = grouped.get(stage) ?? [];
        const total = columnTotal(rows);
        const tone = statusToTone(stage);
        return (
          <div
            key={stage}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) handleDrop(stage, id);
            }}
          >
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <div className="flex items-center gap-2">
                <StatusPill label={stage} tone={tone} />
                <span className="text-[11.5px] text-[var(--st-text-secondary)]">{rows.length}</span>
              </div>
              <span className="font-mono text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
                {fmtMoney(total, currency)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.length === 0 ? (
                <div className="rounded border border-dashed border-[var(--st-border)] px-2 py-6 text-center text-[12px] text-[var(--st-text-secondary)]">
                  Drop deals here
                </div>
              ) : (
                rows.map((deal) => {
                  const isPending = pending.has(deal._id);
                  const isDragging = draggingId === deal._id;
                  
                  return (
                    <Card
                      key={deal._id}
                      draggable={!isPending}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', deal._id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggingId(deal._id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`kanban-card cursor-grab p-3 transition-opacity ${
                        !isPending ? 'active:cursor-grabbing' : ''
                      } ${isDragging || isPending ? 'opacity-50' : ''}`}
                    >
                      <Link
                        href={`/dashboard/crm/sales-crm/deals/${deal._id}`}
                        className="block min-w-0 flex-1 text-[13px] font-medium text-[var(--st-text)] hover:underline"
                        onClick={(e) => isPending && e.preventDefault()}
                      >
                        {deal.name || 'Untitled deal'}
                      </Link>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-[var(--st-text-secondary)]">
                        <span className="truncate">{deal.clientLabel ?? '—'}</span>
                        <div className="text-right">
                          <span className="block font-mono tabular-nums text-[var(--st-text)]">
                            {fmtMoney(deal.amount, deal.currency ?? currency)}
                          </span>
                          {typeof deal.probability === 'number' && typeof deal.amount === 'number' ? (
                            <span className="block text-[10px] font-mono tabular-nums text-[var(--st-text-secondary)]" title="Expected Value (Amount × Probability)">
                              EV: {fmtMoney(deal.amount * (deal.probability / 100), deal.currency ?? currency)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {deal.expectedClose
                            ? new Date(deal.expectedClose).toLocaleDateString()
                            : '—'}
                        </span>
                        {typeof deal.probability === 'number' ? (
                          <Badge variant="outline">{deal.probability}%</Badge>
                        ) : null}
                      </div>
                      {deal.ownerId ? (
                        <div className="mt-1.5">
                          <EntityPickerChip entity="user" id={deal.ownerId} />
                        </div>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </div>

            {/* Empty + add hint */}
            {rows.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="mt-1 w-full justify-start text-[var(--st-text-secondary)]"
              >
                <Link href={`/dashboard/crm/sales-crm/deals/new?stage=${encodeURIComponent(stage)}`}>
                  <Trophy className="h-3 w-3" /> Add to {stage}
                </Link>
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

