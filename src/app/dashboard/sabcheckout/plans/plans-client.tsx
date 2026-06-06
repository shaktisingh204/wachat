'use client';

/**
 * Plans CRUD client. Inline create row + inline edit row for each plan.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit3, MoreHorizontal, Copy, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';

import {
  createSabcheckoutPlan,
  deleteSabcheckoutPlan,
  updateSabcheckoutPlan,
} from '@/app/actions/sabcheckout.actions';
import type {
  SabcheckoutPlanDoc,
  SabcheckoutPlanIntervalUnit,
} from '@/lib/rust-client/sabcheckout-plans';

interface DraftPlan {
  name: string;
  intervalUnit: SabcheckoutPlanIntervalUnit;
  intervalCount: number;
  amountMinor: number;
  currency: string;
  trialDays?: number;
}

export function SabcheckoutPlansClient({
  initial,
}: {
  initial: SabcheckoutPlanDoc[];
}) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [draft, setDraft] = React.useState<DraftPlan>({
    name: '',
    intervalUnit: 'month',
    intervalCount: 1,
    amountMinor: 99900,
    currency: 'INR',
  });
  const [busy, setBusy] = React.useState(false);

  async function onCreate() {
    if (!draft.name.trim()) {
      toast({ title: 'Name required' });
      return;
    }
    setBusy(true);
    const res = await createSabcheckoutPlan({
      name: draft.name.trim(),
      intervalUnit: draft.intervalUnit,
      intervalCount: draft.intervalCount,
      amountMinor: draft.amountMinor,
      currency: draft.currency,
      trialDays: draft.trialDays,
      status: 'active',
    });
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Create failed', description: res.error });
      return;
    }
    setDraft({
      name: '',
      intervalUnit: 'month',
      intervalCount: 1,
      amountMinor: 99900,
      currency: 'INR',
    });
    router.refresh();
  }

  async function onArchive(id: string) {
    if (!confirm('Archive this plan?')) return;
    const res = await deleteSabcheckoutPlan(id);
    if (!res.ok) {
      toast({ title: 'Archive failed', description: res.error });
      return;
    }
    router.refresh();
  }

  async function onActivate(id: string) {
    const res = await updateSabcheckoutPlan(id, { status: 'active' });
    if (!res.ok) {
      toast({ title: 'Update failed', description: res.error });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Create row */}
      <Card>
        <ZoruCardHeader className="pb-4 border-b border-zoru-line">
          <ZoruCardTitle>New plan</ZoruCardTitle>
          <ZoruCardDescription>Create a new recurring subscription tier</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] items-end">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zoru-ink-subtle uppercase tracking-wider">Name</Label>
              <Input
                placeholder="e.g. Pro Monthly"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zoru-ink-subtle uppercase tracking-wider">Interval</Label>
              <Select
                value={draft.intervalUnit}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    intervalUnit: v as SabcheckoutPlanIntervalUnit,
                  })
                }
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="day">day</ZoruSelectItem>
                  <ZoruSelectItem value="week">week</ZoruSelectItem>
                  <ZoruSelectItem value="month">month</ZoruSelectItem>
                  <ZoruSelectItem value="year">year</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zoru-ink-subtle uppercase tracking-wider">Every</Label>
              <Input
                type="number"
                min={1}
                value={draft.intervalCount}
                onChange={(e) =>
                  setDraft({ ...draft, intervalCount: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zoru-ink-subtle uppercase tracking-wider">Amount</Label>
              <Input
                type="number"
                placeholder="e.g. 99900"
                value={draft.amountMinor}
                onChange={(e) =>
                  setDraft({ ...draft, amountMinor: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zoru-ink-subtle uppercase tracking-wider">Cur</Label>
              <Input
                value={draft.currency}
                onChange={(e) =>
                  setDraft({ ...draft, currency: e.target.value.toUpperCase() })
                }
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-zoru-ink-subtle uppercase tracking-wider">Trial</Label>
              <Input
                type="number"
                placeholder="Days"
                value={draft.trialDays ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trialDays: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <Button onClick={onCreate} disabled={busy} className="h-10">
              <Plus className="mr-1.5 size-4" />
              Add Plan
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* List */}
      <Card className="overflow-hidden">
        <div className="bg-zoru-surface border-b border-zoru-line px-6 py-4 flex justify-between items-center">
          <h3 className="font-semibold text-zoru-ink">Available Plans</h3>
          <Badge variant="secondary" className="font-mono">{initial.length} total</Badge>
        </div>
        <ZoruCardContent className="p-0">
          {initial.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted mb-4">
                <RefreshCw className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-zoru-ink">No plans found</p>
              <p className="text-xs text-zoru-ink-muted mt-1">Add your first subscription plan above.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--zoru-border)]">
              {initial.map((p) => (
                <li
                  key={p._id}
                  className="group flex items-center justify-between gap-4 px-6 py-4 hover:bg-zoru-surface-hover/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="truncate text-[15px] font-medium text-zoru-ink">
                        {p.name}
                      </span>
                      <Badge
                        variant={p.status === 'active' ? 'default' : 'secondary'}
                        className="h-5 text-[11px]"
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-[var(--zoru-muted-fg)]">
                      <span className="font-semibold text-zoru-ink">
                        {p.currency} {(p.amountMinor / 100).toFixed(2)}
                      </span>
                      <span>
                        every {p.intervalCount} {p.intervalUnit}
                      </span>
                      {p.trialDays && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-zoru-ink-subtle"></span>
                          <span>{p.trialDays} days trial</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {p.status === 'archived' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onActivate(p._id)}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit3 className="mr-2 h-4 w-4" /> Edit Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-zoru-danger focus:text-zoru-danger"
                              onClick={() => onArchive(p._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}
