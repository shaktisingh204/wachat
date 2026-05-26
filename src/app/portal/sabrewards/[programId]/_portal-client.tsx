'use client';

/**
 * Customer-facing rewards storefront client. Shows the member's balance,
 * lets them redeem an active catalog item, and exposes a one-click
 * referral link generator. Everything is built on ZoruUI primitives;
 * no legacy clay/shadcn-default styling.
 */

import * as React from 'react';
import { Coins, Copy, Crown, Gift, Share2, Sparkles } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';

import {
  createRewardsRedemption,
  createRewardsReferral,
} from '@/app/actions/rewards.actions';
import type { RewardsCatalogItemDoc } from '@/lib/rust-client/rewards-catalog';
import type { RewardsMemberDoc } from '@/lib/rust-client/rewards-members';
import type { RewardsReferralDoc } from '@/lib/rust-client/rewards-referrals';

interface Props {
  programId: string;
  programName: string;
  programDescription: string;
  member: RewardsMemberDoc | null;
  catalog: RewardsCatalogItemDoc[];
  myReferral: RewardsReferralDoc | null;
  referrerCode: string | null;
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function RewardsPortalClient({
  programId,
  programName,
  programDescription,
  member,
  catalog,
  myReferral,
  referrerCode,
}: Props): React.JSX.Element {
  const { toast } = useZoruToast();

  const [redeemTarget, setRedeemTarget] = React.useState<RewardsCatalogItemDoc | null>(null);
  const [redeemOpen, setRedeemOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [referral, setReferral] = React.useState<RewardsReferralDoc | null>(myReferral);
  const [referralBusy, setReferralBusy] = React.useState(false);

  const balance = member?.currentPoints ?? 0;
  const tier = member?.currentTier ?? 'Base';

  const handleRedeem = React.useCallback(async () => {
    if (!member || !redeemTarget) return;
    if (balance < redeemTarget.pointsCost) {
      toast({ title: 'Not enough points', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await createRewardsRedemption({
        memberId: member._id,
        catalogItemId: redeemTarget._id,
        points: redeemTarget.pointsCost,
      });
      if (!res.success) throw new Error(res.error);
      toast({
        title: 'Redemption requested',
        description: 'We will reach out once your reward is ready.',
      });
      setRedeemOpen(false);
    } catch (e) {
      toast({
        title: 'Redemption failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }, [member, redeemTarget, balance, toast]);

  const generateLink = React.useCallback(async () => {
    if (!member) return;
    setReferralBusy(true);
    try {
      const code = randomCode();
      const res = await createRewardsReferral({
        memberId: member._id,
        code,
        programId,
      });
      if (!res.success) throw new Error(res.error);
      setReferral({
        _id: res.data?.id ?? '',
        memberId: member._id,
        programId,
        code,
        sharedAt: new Date().toISOString(),
        conversions: [],
        rewardPoints: 0,
        active: true,
      });
      toast({ title: 'Referral link ready' });
    } catch (e) {
      toast({
        title: 'Could not generate link',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setReferralBusy(false);
    }
  }, [member, programId, toast]);

  const referralUrl = React.useMemo(() => {
    if (!referral) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/portal/sabrewards/${programId}?ref=${encodeURIComponent(referral.code)}`;
  }, [referral, programId]);

  const handleCopy = React.useCallback(() => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(
      () => toast({ title: 'Link copied' }),
      () => toast({ title: 'Copy failed', variant: 'destructive' }),
    );
  }, [referralUrl, toast]);

  return (
    <div className="zoruui min-h-screen bg-zoru-bg p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Rewards
          </p>
          <h1 className="text-3xl font-semibold text-zoru-ink">{programName}</h1>
          {programDescription ? (
            <p className="max-w-2xl text-sm text-zoru-ink-muted">{programDescription}</p>
          ) : null}
          {referrerCode ? (
            <p className="text-[12px] text-zoru-ink-muted">
              You arrived via referral code{' '}
              <code className="font-mono text-zoru-ink">{referrerCode}</code> — your inviter
              will be credited when you qualify.
            </p>
          ) : null}
        </header>

        <Card>
          <ZoruCardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zoru-brand/10 text-zoru-brand">
                <Coins className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[12px] text-zoru-ink-muted">Your balance</p>
                <p className="text-2xl font-semibold text-zoru-ink">
                  {balance.toLocaleString()} pts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Crown className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[12px] text-zoru-ink-muted">Current tier</p>
                <Badge variant="success">{tier}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-muted text-zoru-ink">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[12px] text-zoru-ink-muted">Lifetime points</p>
                <p className="text-base font-semibold text-zoru-ink">
                  {(member?.lifetimePoints ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </ZoruCardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zoru-ink">Available rewards</h2>
          {catalog.length === 0 ? (
            <EmptyState
              title="No rewards available yet"
              description="Check back soon — we are adding redeemable items."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((item) => {
                const affordable = balance >= item.pointsCost;
                return (
                  <Card key={item._id} className="flex flex-col p-4">
                    <div className="flex h-32 w-full items-center justify-center rounded-md bg-zoru-surface-muted">
                      <Gift className="h-10 w-10 text-zoru-ink-muted" />
                    </div>
                    <div className="mt-3 flex flex-col gap-1">
                      <h3 className="text-base font-semibold text-zoru-ink">{item.name}</h3>
                      {item.description ? (
                        <p className="text-[12px] text-zoru-ink-muted">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-zoru-ink">
                        {item.pointsCost.toLocaleString()} pts
                      </span>
                      <Button
                        size="sm"
                        disabled={!member || !affordable}
                        onClick={() => {
                          setRedeemTarget(item);
                          setRedeemOpen(true);
                        }}
                      >
                        Redeem
                      </Button>
                    </div>
                    {!affordable ? (
                      <p className="mt-1 text-[11px] text-zoru-ink-muted">
                        Need {(item.pointsCost - balance).toLocaleString()} more points.
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4" /> Refer a friend
              </ZoruCardTitle>
              <ZoruCardDescription>
                Share your unique link — earn points when your friends qualify.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="flex flex-col gap-3">
              {referral ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="referral-link">Your referral link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="referral-link"
                      readOnly
                      value={referralUrl}
                      className="font-mono text-[12px]"
                    />
                    <Button variant="outline" onClick={handleCopy}>
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                  <p className="text-[12px] text-zoru-ink-muted">
                    Conversions so far:{' '}
                    <strong>{referral.conversions?.length ?? 0}</strong> · Points earned:{' '}
                    <strong>{(referral.rewardPoints ?? 0).toLocaleString()}</strong>
                  </p>
                </div>
              ) : (
                <Button onClick={generateLink} disabled={!member || referralBusy}>
                  {referralBusy ? 'Generating…' : 'Generate my referral link'}
                </Button>
              )}
            </ZoruCardContent>
          </Card>
        </section>
      </div>

      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Confirm redemption</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="py-2 text-sm text-zoru-ink">
            {redeemTarget ? (
              <p>
                Redeem <strong>{redeemTarget.name}</strong> for{' '}
                <strong>{redeemTarget.pointsCost.toLocaleString()} points</strong>?
              </p>
            ) : null}
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setRedeemOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleRedeem} disabled={busy}>
              {busy ? 'Redeeming…' : 'Redeem'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
