'use client';

import { ZoruBadge, ZoruCard, ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Clock,
  Trophy } from 'lucide-react';

/**
 * <DealKanban> — drag-between-columns deal pipeline board.
 *
 * Each column is a deal stage. Dragging a card from one column to
 * another calls `updateCrmDealStage` and optimistically reorders local
 * state; if the server rejects the change we revert and toast.
 *
 * Uses the native HTML5 drag-and-drop API to avoid an extra dependency.
 * The drag-target uses the underlying card's id to identify the deal;
 * the column receives the drop event and dispatches the stage update.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { updateCrmDealStage } from '@/app/actions/crm-deals.actions';
import { statusToTone, StatusPill } from '@/components/crm/status-pill';
import type { DealListRow } from './types';

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

  // Local mirror so we can optimistically move cards before the server confirms.
  const [board, setBoard] = React.useState<DealListRow[]>(deals);
  const [, startTransition] = React.useTransition();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  // Re-sync when the upstream `deals` prop changes (server refetch).
  React.useEffect(() => {
    setBoard(deals);
  }, [deals]);

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
    const target = board.find((d) => d._id === dealId);
    if (!target || target.stage === newStage) {
      setDraggingId(null);
      return;
    }
    const oldStage = target.stage;

    // Optimistic update
    setBoard((rows) =>
      rows.map((r) => (r._id === dealId ? { ...r, stage: newStage } : r)),
    );
    setDraggingId(null);

    startTransition(async () => {
      const res = await updateCrmDealStage(dealId, newStage);
      if (!res.success) {
        // Revert
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
    <div className="flex w-full gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const rows = grouped.get(stage) ?? [];
        const total = columnTotal(rows);
        const tone = statusToTone(stage);
        return (
          <div
            key={stage}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 p-2"
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
                <span className="text-[11.5px] text-zoru-ink-muted">{rows.length}</span>
              </div>
              <span className="font-mono text-[11.5px] tabular-nums text-zoru-ink-muted">
                {fmtMoney(total, currency)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.length === 0 ? (
                <div className="rounded border border-dashed border-zoru-line px-2 py-6 text-center text-[12px] text-zoru-ink-muted">
                  Drop deals here
                </div>
              ) : (
                rows.map((deal) => (
                  <ZoruCard
                    key={deal._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', deal._id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(deal._id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`cursor-grab p-3 transition-opacity active:cursor-grabbing ${
                      draggingId === deal._id ? 'opacity-50' : ''
                    }`}
                  >
                    <Link
                      href={`/dashboard/crm/sales-crm/deals/${deal._id}`}
                      className="block min-w-0 flex-1 text-[13px] font-medium text-zoru-ink hover:underline"
                    >
                      {deal.name || 'Untitled deal'}
                    </Link>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-zoru-ink-muted">
                      <span className="truncate">{deal.clientLabel ?? '—'}</span>
                      <span className="font-mono tabular-nums text-zoru-ink">
                        {fmtMoney(deal.amount, deal.currency ?? currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-zoru-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {deal.expectedClose
                          ? new Date(deal.expectedClose).toLocaleDateString()
                          : '—'}
                      </span>
                      {typeof deal.probability === 'number' ? (
                        <ZoruBadge variant="outline">{deal.probability}%</ZoruBadge>
                      ) : null}
                    </div>
                    {deal.ownerId ? (
                      <div className="mt-1.5">
                        <EntityPickerChip entity="user" id={deal.ownerId} />
                      </div>
                    ) : null}
                  </ZoruCard>
                ))
              )}
            </div>

            {/* Empty + add hint */}
            {rows.length > 0 ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                asChild
                className="mt-1 w-full justify-start text-zoru-ink-muted"
              >
                <Link href={`/dashboard/crm/sales-crm/deals/new?stage=${encodeURIComponent(stage)}`}>
                  <Trophy className="h-3 w-3" /> Add to {stage}
                </Link>
              </ZoruButton>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
