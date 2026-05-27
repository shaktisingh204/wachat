'use client';

/**
 * Plans CRUD client. Inline create row + inline edit row for each plan.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';

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
        <ZoruCardHeader>
          <ZoruCardTitle>New plan</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-3 sm:grid-cols-[1.5fr_120px_100px_140px_120px_100px_auto]">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Interval</Label>
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
          <div className="space-y-1">
            <Label className="text-xs">Every</Label>
            <Input
              type="number"
              min={1}
              value={draft.intervalCount}
              onChange={(e) =>
                setDraft({ ...draft, intervalCount: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount (minor)</Label>
            <Input
              type="number"
              value={draft.amountMinor}
              onChange={(e) =>
                setDraft({ ...draft, amountMinor: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Currency</Label>
            <Input
              value={draft.currency}
              onChange={(e) =>
                setDraft({ ...draft, currency: e.target.value.toUpperCase() })
              }
              maxLength={3}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Trial days</Label>
            <Input
              type="number"
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
          <div className="flex items-end">
            <Button onClick={onCreate} disabled={busy}>
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* List */}
      <Card>
        <ZoruCardContent className="p-0">
          {initial.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--zoru-muted-fg)]">
              No plans yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--zoru-border)]">
              {initial.map((p) => (
                <li
                  key={p._id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <Badge
                        variant={p.status === 'active' ? 'default' : 'secondary'}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-[var(--zoru-muted-fg)]">
                      {p.currency} {(p.amountMinor / 100).toFixed(2)} every{' '}
                      {p.intervalCount} {p.intervalUnit}
                      {p.trialDays ? ` · ${p.trialDays}d trial` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.status === 'archived' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onActivate(p._id)}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onArchive(p._id)}
                        aria-label="Archive plan"
                      >
                        <Trash2 className="size-4" />
                      </Button>
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
