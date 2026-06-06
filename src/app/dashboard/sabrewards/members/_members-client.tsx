'use client';

/**
 * Rewards members table with per-row "Adjust points" drawer. Each row
 * exposes the customer's current balance, lifetime total, and current
 * tier (the tier label comes from the program's referenced loyalty
 * engine — we don't recompute tiers here, the engine is authoritative).
 */

import * as React from 'react';
import { Sparkles } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import { adjustRewardsMember } from '@/app/actions/rewards.actions';
import type { RewardsMemberDoc } from '@/lib/rust-client/rewards-members';

interface ProgramOption {
  id: string;
  name: string;
}

export function MembersClient({
  initialMembers,
  programs,
}: {
  initialMembers: RewardsMemberDoc[];
  programs: ProgramOption[];
}): React.JSX.Element {
  const { toast } = useZoruToast();

  const [members, setMembers] = React.useState<RewardsMemberDoc[]>(initialMembers);
  const [programFilter, setProgramFilter] = React.useState<string>('all');
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [target, setTarget] = React.useState<RewardsMemberDoc | null>(null);
  const [delta, setDelta] = React.useState<number>(0);
  const [newTier, setNewTier] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  const programNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    programs.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [programs]);

  const filtered = React.useMemo(() => {
    if (programFilter === 'all') return members;
    return members.filter((m) => m.programId === programFilter);
  }, [members, programFilter]);

  const openAdjust = React.useCallback((m: RewardsMemberDoc) => {
    setTarget(m);
    setDelta(0);
    setNewTier(m.currentTier ?? '');
    setAdjustOpen(true);
  }, []);

  const handleApply = React.useCallback(async () => {
    if (!target) return;
    setSaving(true);
    try {
      const res = await adjustRewardsMember(target._id, {
        delta,
        newTier: newTier.trim() || undefined,
      });
      if (!res.success) throw new Error(res.error);
      setMembers((prev) =>
        prev.map((m) =>
          m._id === target._id
            ? {
                ...m,
                currentPoints: (m.currentPoints ?? 0) + delta,
                lifetimePoints:
                  delta > 0 ? (m.lifetimePoints ?? 0) + delta : m.lifetimePoints ?? 0,
                currentTier: newTier.trim() || m.currentTier,
              }
            : m,
        ),
      );
      toast({ title: 'Member balance updated' });
      setAdjustOpen(false);
    } catch (e) {
      toast({
        title: 'Adjustment failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [target, delta, newTier, toast]);

  return (
    <div className="zoruui flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--st-text)]">Members</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Each customer who has joined a rewards program. Adjust balances or
            promote tiers manually here.
          </p>
        </div>
        <div className="w-48">
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="All programs" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All programs</ZoruSelectItem>
              {programs.map((p) => (
                <ZoruSelectItem key={p.id} value={p.id}>
                  {p.name}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-[var(--st-border)]">
                <ZoruTableHead>Customer</ZoruTableHead>
                <ZoruTableHead>Program</ZoruTableHead>
                <ZoruTableHead>Tier</ZoruTableHead>
                <ZoruTableHead>Current points</ZoruTableHead>
                <ZoruTableHead>Lifetime points</ZoruTableHead>
                <ZoruTableHead>Joined</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={7} className="p-0">
                    <EmptyState
                      title="No members"
                      description="Once customers join a program they will appear here."
                    />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((m) => (
                  <ZoruTableRow key={m._id} className="border-[var(--st-border)]">
                    <ZoruTableCell className="text-[var(--st-text)]">
                      Customer {m.customerId.slice(-6)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[var(--st-text)]">
                      {programNameById.get(m.programId) ?? '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={m.currentTier ? 'success' : 'ghost'}>
                        {m.currentTier ?? 'Base'}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[var(--st-text)]">
                      {(m.currentPoints ?? 0).toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[var(--st-text)]">
                      {(m.lifetimePoints ?? 0).toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[var(--st-text)]">
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openAdjust(m)}>
                        <Sparkles className="h-4 w-4" /> Adjust
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Adjust points</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adjust-delta">Delta (use negative to debit)</Label>
              <Input
                id="adjust-delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
              <p className="text-[12px] text-[var(--st-text-secondary)]">
                Positive deltas also bump lifetime points; negative deltas do not.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adjust-tier">New tier (optional)</Label>
              <Input
                id="adjust-tier"
                value={newTier}
                onChange={(e) => setNewTier(e.target.value)}
                placeholder="e.g. Gold"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={saving}>
              {saving ? 'Applying…' : 'Apply'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
