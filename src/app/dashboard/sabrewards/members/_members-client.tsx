'use client';

/**
 * Rewards members table with per-row "Adjust points" drawer. Each row
 * exposes the customer's current balance, lifetime total, and current
 * tier (the tier label comes from the program's referenced loyalty
 * engine; we don't recompute tiers here, the engine is authoritative).
 */

import * as React from 'react';
import { Sparkles, Users, Coins, Trophy } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';

import { adjustRewardsMember } from '@/app/actions/rewards.actions';
import type { RewardsMemberDoc } from '@/lib/rust-client/rewards-members';

import { SectionToolbar } from '../_components/section-toolbar';

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
  const { toast } = useToast();

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

  const stats = React.useMemo(() => {
    const activePoints = filtered.reduce((sum, m) => sum + (m.currentPoints ?? 0), 0);
    const tiered = filtered.filter((m) => m.currentTier).length;
    return { count: filtered.length, activePoints, tiered };
  }, [filtered]);

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
      toast.success('Member balance updated');
      setAdjustOpen(false);
    } catch (e) {
      toast({
        title: 'Adjustment failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }, [target, delta, newTier, toast]);

  return (
    <div className="20ui flex flex-col gap-5">
      <SectionToolbar
        icon={Users}
        title="Members"
        description="Customers enrolled in a rewards program. Adjust balances or promote tiers manually."
        actions={
          <div className="w-48">
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger aria-label="Filter by program">
                <SelectValue placeholder="All programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <section aria-label="Member metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Members" value={stats.count.toLocaleString()} icon={<Users />} accent="#2b6ef2" />
        <StatCard label="Active points" value={stats.activePoints.toLocaleString()} icon={<Coins />} accent="#d97706" />
        <StatCard label="Tiered members" value={stats.tiered.toLocaleString()} icon={<Trophy />} accent="#16a34a" />
      </section>

      <Card padding="none">
        <div className="overflow-x-auto rounded-[var(--st-radius)]">
          <Table>
            <THead>
              <Tr>
                <Th>Customer</Th>
                <Th>Program</Th>
                <Th>Tier</Th>
                <Th align="right">Current points</Th>
                <Th align="right">Lifetime points</Th>
                <Th>Joined</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={7} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="No members"
                      description="Customers appear here once they join a program."
                    />
                  </Td>
                </Tr>
              ) : (
                filtered.map((m) => (
                  <Tr key={m._id}>
                    <Td className="text-[var(--st-text)]">
                      Customer {m.customerId.slice(-6)}
                    </Td>
                    <Td className="text-[var(--st-text)]">
                      {programNameById.get(m.programId) ?? 'Unassigned'}
                    </Td>
                    <Td>
                      <Badge tone={m.currentTier ? 'success' : 'neutral'}>
                        {m.currentTier ?? 'Base'}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums text-[var(--st-text)]">
                      {(m.currentPoints ?? 0).toLocaleString()}
                    </Td>
                    <Td align="right" className="tabular-nums text-[var(--st-text)]">
                      {(m.lifetimePoints ?? 0).toLocaleString()}
                    </Td>
                    <Td className="text-[var(--st-text)]">
                      {m.joinedAt
                        ? new Date(m.joinedAt).toLocaleDateString()
                        : 'Not recorded'}
                    </Td>
                    <Td align="right">
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={Sparkles}
                        onClick={() => openAdjust(m)}
                      >
                        Adjust
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust points</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Field
              label="Delta (use negative to debit)"
              help="Positive deltas also bump lifetime points; negative deltas do not."
            >
              <Input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </Field>
            <Field label="New tier (optional)">
              <Input
                value={newTier}
                onChange={(e) => setNewTier(e.target.value)}
                placeholder="e.g. Gold"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleApply} loading={saving} disabled={saving}>
              {saving ? 'Applying' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
