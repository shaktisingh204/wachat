'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

import { Card, Button, Badge, useZoruToast } from '@/components/zoruui';
import { Clock, FileText, Plus } from 'lucide-react';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { updateQuotationStatus } from '@/app/actions/crm/quotations.actions';

import type { QuotationListRow } from './types';
import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, Flip);
}

interface QuotationKanbanProps {
  quotations: QuotationListRow[];
  currency: string;
}

const STAGES: CrmQuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

function fmtMoney(value: number | undefined | null, currency: string): string {
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

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export function QuotationKanban({ quotations, currency }: QuotationKanbanProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const flipStateRef = React.useRef<Flip.State | null>(null);

  const [board, setBoard] = React.useState<QuotationListRow[]>(quotations);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const pendingRef = React.useRef<Set<string>>(new Set());

  const addPending = (id: string) => {
    pendingRef.current.add(id);
    setPending(new Set(pendingRef.current));
  };
  const removePending = (id: string) => {
    pendingRef.current.delete(id);
    setPending(new Set(pendingRef.current));
  };

  React.useEffect(() => {
    setBoard((prevBoard) => {
      return quotations.map((serverRow) => {
        if (pendingRef.current.has(serverRow._id)) {
          const optimistic = prevBoard.find((p) => p._id === serverRow._id);
          if (optimistic) {
            return { ...serverRow, status: optimistic.status };
          }
        }
        return serverRow;
      });
    });
  }, [quotations]);

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
    const map = new Map<string, QuotationListRow[]>();
    for (const s of STAGES) map.set(s, []);
    for (const q of board) {
      const key = q.status ?? 'draft';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return map;
  }, [board]);

  const columnTotal = (rows: QuotationListRow[]): number =>
    rows.reduce((sum, r) => sum + (typeof r.total === 'number' ? r.total : 0), 0);

  const handleDrop = (newStage: string, quotationId: string) => {
    if (pending.has(quotationId)) {
      setDraggingId(null);
      return;
    }

    const target = board.find((d) => d._id === quotationId);
    if (!target || target.status === newStage) {
      setDraggingId(null);
      return;
    }
    const oldStage = target.status;

    flipStateRef.current = Flip.getState('.kanban-card');

    setBoard((rows) =>
      rows.map((r) => (r._id === quotationId ? { ...r, status: newStage } : r)),
    );
    addPending(quotationId);
    setDraggingId(null);

    React.startTransition(async () => {
      const res = await updateQuotationStatus(quotationId, newStage);
      removePending(quotationId);

      if (!res.success) {
        flipStateRef.current = Flip.getState('.kanban-card');
        setBoard((rows) =>
          rows.map((r) => (r._id === quotationId ? { ...r, status: oldStage } : r)),
        );
        toast({
          title: 'Could not update status',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Status updated',
        description: `Moved to ${newStage}.`,
      });
      router.refresh();
    });
  };

  return (
    <div ref={containerRef} className="flex w-full gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
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
                <StatusPill label={stage.replace(/_/g, ' ')} tone={tone} />
                <span className="text-[11.5px] text-zoru-ink-muted">{rows.length}</span>
              </div>
              <span className="font-mono text-[11.5px] tabular-nums text-zoru-ink-muted">
                {fmtMoney(total, currency)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.length === 0 ? (
                <div className="rounded border border-dashed border-zoru-line px-2 py-6 text-center text-[12px] text-zoru-ink-muted">
                  Drop quotations here
                </div>
              ) : (
                rows.map((quotation) => {
                  const isPending = pending.has(quotation._id);
                  const isDragging = draggingId === quotation._id;

                  return (
                    <Card
                      key={quotation._id}
                      draggable={!isPending}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', quotation._id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggingId(quotation._id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`kanban-card cursor-grab p-3 transition-opacity ${
                        !isPending ? 'active:cursor-grabbing' : ''
                      } ${isDragging || isPending ? 'opacity-50' : ''}`}
                    >
                      <Link
                        href={`/dashboard/crm/sales/quotations/${quotation._id}`}
                        className="block min-w-0 flex-1 text-[13px] font-medium text-zoru-ink hover:underline"
                        onClick={(e) => isPending && e.preventDefault()}
                      >
                        {quotation.subject || quotation.quotationNo}
                      </Link>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-zoru-ink-muted">
                        <span className="font-mono text-[11.5px]">{quotation.quotationNo}</span>
                        <span className="block font-mono tabular-nums text-zoru-ink">
                          {fmtMoney(quotation.total, quotation.currency ?? currency)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-zoru-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {fmtDate(quotation.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDate(quotation.validUntil)}
                        </span>
                      </div>
                      {quotation.salesAgentId || quotation.clientId ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {quotation.clientId ? (
                            <EntityPickerChip entity="customer" id={quotation.clientId} />
                          ) : null}
                          {quotation.salesAgentId ? (
                            <EntityPickerChip entity="user" id={quotation.salesAgentId} />
                          ) : null}
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
                className="mt-1 w-full justify-start text-zoru-ink-muted"
              >
                <Link href={`/dashboard/crm/sales/quotations/new?status=${encodeURIComponent(stage)}`}>
                  <Plus className="h-3 w-3" /> Add to {stage}
                </Link>
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
