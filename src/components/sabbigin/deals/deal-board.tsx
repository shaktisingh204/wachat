'use client';

/**
 * SabBigin pipeline board — native HTML5 drag-and-drop kanban.
 *
 * Cards are grouped by stage NAME (matching `crm_deals.stage`). Dropping a
 * card calls `moveSabbiginDealStage`, which enforces the SabBigin stage
 * governance: a gated stage opens a required-field modal first; an
 * approval-gated stage freezes the move and raises an approval request.
 * Moves are optimistic and roll back on failure.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, GripVertical, AlertTriangle } from 'lucide-react';

import { Badge, Button, Modal, Field, Input, toast } from '@/components/sabcrm/20ui';
import {
  moveSabbiginDealStage,
  type DealFieldPatch,
} from '@/app/actions/sabbigin-deals.actions';
import type { SabDealRow, SabStage } from '@/components/sabbigin/lib/types';
import {
  formatCurrency,
  formatDate,
  badgeToneForStage,
  initials,
} from '@/components/sabbigin/lib/format';

const FIELD_LABELS: Record<string, string> = {
  value: 'Deal value',
  probability: 'Probability (%)',
  closeDate: 'Expected close date',
  description: 'Description',
  nextStep: 'Next step',
  ownerId: 'Owner',
  priority: 'Priority',
};

const NUMERIC_FIELDS = new Set(['value', 'probability']);
const DATE_FIELDS = new Set(['closeDate']);

interface PendingGate {
  dealId: string;
  toStage: string;
  fields: string[];
}

export function DealBoard({
  stages,
  deals: initialDeals,
  currency = 'INR',
}: {
  stages: SabStage[];
  deals: SabDealRow[];
  currency?: string;
}) {
  const router = useRouter();
  const [deals, setDeals] = React.useState<SabDealRow[]>(initialDeals);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<string | null>(null);
  const [gate, setGate] = React.useState<PendingGate | null>(null);
  const [gateValues, setGateValues] = React.useState<DealFieldPatch>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setDeals(initialDeals), [initialDeals]);

  const byStage = React.useMemo(() => {
    const map = new Map<string, SabDealRow[]>();
    for (const s of stages) map.set(s.name, []);
    for (const d of deals) {
      if (!map.has(d.stage)) map.set(d.stage, []);
      map.get(d.stage)!.push(d);
    }
    return map;
  }, [deals, stages]);

  async function commitMove(
    dealId: string,
    toStage: string,
    patch?: DealFieldPatch,
  ) {
    const prev = deals;
    setDeals((cur) =>
      cur.map((d) => (d._id === dealId ? { ...d, stage: toStage } : d)),
    );
    setSaving(true);
    const res = await moveSabbiginDealStage(dealId, toStage, patch);
    setSaving(false);
    if (res.success) {
      toast.success({ title: 'Deal moved', description: `Moved to ${toStage}.` });
      router.refresh();
      return;
    }
    // revert optimistic move
    setDeals(prev);
    if (res.requiredFields?.length) {
      setGate({ dealId, toStage, fields: res.requiredFields });
      setGateValues({});
      return;
    }
    if (res.pendingApproval) {
      toast.warning({
        title: 'Sent for approval',
        description: `Moving to ${toStage} needs sign-off.`,
      });
      return;
    }
    toast.error({ title: 'Move failed', description: res.error ?? 'Try again.' });
  }

  function onDrop(stageName: string) {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const deal = deals.find((d) => d._id === id);
    if (!deal || deal.stage === stageName) return;
    void commitMove(id, stageName);
  }

  async function submitGate() {
    if (!gate) return;
    await commitMove(gate.dealId, gate.toStage, gateValues);
    setGate(null);
  }

  return (
    <div className="20ui">
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const rows = byStage.get(stage.name) ?? [];
          const total = rows.reduce((s, d) => s + (d.amount ?? 0), 0);
          const isOver = overStage === stage.name;
          return (
            <div
              key={stage.id || stage.name}
              className="flex w-[300px] shrink-0 flex-col rounded-[var(--st-radius-md)] border border-[var(--st-border)] bg-[var(--st-surface-2,rgba(0,0,0,0.02))]"
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.name);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.name ? null : s))}
              onDrop={() => onDrop(stage.name)}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: stage.color || 'var(--st-accent)' }}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-[var(--st-text)]">
                    {stage.name}
                  </span>
                  <Badge tone="neutral">{rows.length}</Badge>
                  {(stage.requiredFields?.length || stage.approvalRequired) && (
                    <AlertTriangle
                      className="h-3.5 w-3.5 text-[var(--st-warning,#c98a00)]"
                      aria-label="This stage has entry rules"
                    />
                  )}
                </div>
                <Link
                  href={`/dashboard/sabbigin/deals/new?stage=${encodeURIComponent(stage.name)}`}
                  className="u-icon-btn u-icon-btn--sm"
                  aria-label={`Add deal to ${stage.name}`}
                >
                  <Plus size={14} />
                </Link>
              </div>

              <div
                className={`flex min-h-[120px] flex-1 flex-col gap-2 p-2 transition-colors ${
                  isOver ? 'bg-[var(--st-accent-soft,rgba(59,122,245,0.08))]' : ''
                }`}
              >
                {rows.map((deal) => (
                  <Link
                    key={deal._id}
                    href={`/dashboard/sabbigin/deals/${deal._id}`}
                    draggable
                    onDragStart={() => setDragId(deal._id)}
                    onDragEnd={() => setDragId(null)}
                    className={`group block cursor-grab rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
                      dragId === deal._id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--st-text-muted,#9aa0a6)] opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--st-text)]">
                          {deal.name}
                        </div>
                        {deal.amount != null && (
                          <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--st-text)]">
                            {formatCurrency(deal.amount, deal.currency || currency)}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--st-text-secondary)]">
                          {deal.contactName && (
                            <span className="inline-flex items-center gap-1">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-accent-soft,#e8effe)] text-[9px] font-semibold text-[var(--st-accent)]">
                                {initials(deal.contactName)}
                              </span>
                              {deal.contactName}
                            </span>
                          )}
                          {deal.expectedClose && (
                            <span>· {formatDate(deal.expectedClose)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="border-t border-[var(--st-border)] px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                <span className="font-medium text-[var(--st-text)]">
                  {formatCurrency(total, currency)}
                </span>{' '}
                · {rows.length} deal{rows.length === 1 ? '' : 's'}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!gate}
        onClose={() => setGate(null)}
        title="Fill required details"
        description={
          gate
            ? `“${gate.toStage}” needs these before a deal can enter it.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGate(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={submitGate}>
              Save &amp; move
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {gate?.fields.map((key) => (
            <Field key={key} label={FIELD_LABELS[key] ?? key}>
              <Input
                type={
                  NUMERIC_FIELDS.has(key)
                    ? 'number'
                    : DATE_FIELDS.has(key)
                      ? 'date'
                      : 'text'
                }
                value={(gateValues[key] as string | number | undefined) ?? ''}
                onChange={(e) =>
                  setGateValues((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  );
}
