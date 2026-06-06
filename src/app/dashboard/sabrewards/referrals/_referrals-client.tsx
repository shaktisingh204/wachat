'use client';

/**
 * Referral codes management + attribution leaderboard. Codes are owned by
 * a member (the inviter). Each conversion the customer drives is logged on
 * the embedded `conversions[]` array and bumps `rewardPoints` — that's the
 * leaderboard sort key.
 */

import * as React from 'react';
import { Plus, Share2, Trash2 } from 'lucide-react';

import { Badge, Button, Card, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';

import {
  createRewardsReferral,
  deleteRewardsReferral,
} from '@/app/actions/rewards.actions';
import type { RewardsReferralDoc } from '@/lib/rust-client/rewards-referrals';

interface ProgramOption {
  id: string;
  name: string;
}
interface MemberOption {
  id: string;
  label: string;
}

export function ReferralsClient({
  initialReferrals,
  programs,
  members,
}: {
  initialReferrals: RewardsReferralDoc[];
  programs: ProgramOption[];
  members: MemberOption[];
}): React.JSX.Element {
  const { toast } = useToast();

  const [referrals, setReferrals] = React.useState<RewardsReferralDoc[]>(initialReferrals);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [memberId, setMemberId] = React.useState<string>('');
  const [programId, setProgramId] = React.useState<string>('');
  const [code, setCode] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  const programNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    programs.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [programs]);

  const memberLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((mm) => m.set(mm.id, mm.label));
    return m;
  }, [members]);

  const handleCreate = React.useCallback(async () => {
    if (!memberId) {
      toast({ title: 'Pick a member', variant: 'destructive' });
      return;
    }
    if (!code.trim()) {
      toast({ title: 'Code is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await createRewardsReferral({
        memberId,
        code: code.trim(),
        programId: programId || undefined,
      });
      if (!res.success) throw new Error(res.error);
      setReferrals((prev) => [
        {
          _id: res.data?.id ?? '',
          memberId,
          programId: programId || undefined,
          code: code.trim(),
          sharedAt: new Date().toISOString(),
          conversions: [],
          rewardPoints: 0,
          active: true,
        } as RewardsReferralDoc,
        ...prev,
      ]);
      toast({ title: 'Referral code created' });
      setDialogOpen(false);
      setCode('');
    } catch (e) {
      toast({
        title: 'Create failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [memberId, programId, code, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!confirm('Deactivate this referral code?')) return;
      const res = await deleteRewardsReferral(id);
      if (res.success) {
        setReferrals((prev) =>
          prev.map((r) => (r._id === id ? { ...r, active: false } : r)),
        );
        toast({ title: 'Code deactivated' });
      } else {
        toast({
          title: 'Failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const handleCopy = React.useCallback(
    (referral: RewardsReferralDoc) => {
      const url = `${window.location.origin}/portal/sabrewards/${referral.programId ?? 'default'}?ref=${encodeURIComponent(referral.code)}`;
      navigator.clipboard.writeText(url).then(
        () => toast({ title: 'Referral link copied' }),
        () => toast({ title: 'Copy failed', variant: 'destructive' }),
      );
    },
    [toast],
  );

  // Leaderboard: top 5 by rewardPoints
  const leaderboard = React.useMemo(
    () => [...referrals].sort((a, b) => (b.rewardPoints ?? 0) - (a.rewardPoints ?? 0)).slice(0, 5),
    [referrals],
  );

  return (
    <div className="zoruui flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--st-text)]">Referrals</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Each code is owned by a member. Conversions and reward credits are
            tracked per code.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New code
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0">
          <div className="overflow-x-auto rounded-lg">
            <Table>
              <THead>
                <Tr className="border-[var(--st-border)]">
                  <Th>Code</Th>
                  <Th>Owner</Th>
                  <Th>Program</Th>
                  <Th>Conversions</Th>
                  <Th>Reward pts</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {referrals.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="p-0">
                      <EmptyState
                        title="No referral codes yet"
                        description="Create the first code and share its link via the customer portal."
                      />
                    </Td>
                  </Tr>
                ) : (
                  referrals.map((r) => (
                    <Tr key={r._id} className="border-[var(--st-border)]">
                      <Td className="font-mono text-[var(--st-text)]">
                        {r.code}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {memberLabelById.get(r.memberId) ?? '—'}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {r.programId ? programNameById.get(r.programId) ?? '—' : '—'}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {(r.conversions?.length ?? 0).toLocaleString()}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {(r.rewardPoints ?? 0).toLocaleString()}
                      </Td>
                      <Td>
                        <Badge variant={r.active ? 'success' : 'ghost'}>
                          {r.active ? 'active' : 'inactive'}
                        </Badge>
                      </Td>
                      <Td className="space-x-1 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(r)}
                          aria-label="Copy referral link"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r._id)}
                          aria-label="Deactivate referral"
                        >
                          <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                        </Button>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-[var(--st-text)]">Attribution leaderboard</h3>
          <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
            Top codes by total points awarded.
          </p>
          <ol className="mt-3 flex flex-col divide-y divide-[var(--st-border)]">
            {leaderboard.length === 0 ? (
              <li className="py-3 text-[13px] text-[var(--st-text-secondary)]">No conversions yet.</li>
            ) : (
              leaderboard.map((r, idx) => (
                <li key={r._id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[11px] font-semibold">
                      {idx + 1}
                    </span>
                    <code className="font-mono text-[var(--st-text)]">{r.code}</code>
                  </div>
                  <span className="font-semibold text-[var(--st-text)]">
                    {(r.rewardPoints ?? 0).toLocaleString()}
                  </span>
                </li>
              ))
            )}
          </ol>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New referral code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Owner (member)</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Program (optional)</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="No program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="referral-code">Code</Label>
              <Input
                id="referral-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FRIEND10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
