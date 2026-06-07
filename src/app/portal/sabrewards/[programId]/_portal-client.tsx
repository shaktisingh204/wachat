'use client';

/**
 * Customer-facing rewards storefront client. Shows the member's balance,
 * lets them redeem an active catalog item, and exposes a one-click
 * referral link generator. Everything is built on 20ui primitives;
 * no legacy clay/shadcn-default styling.
 */

import * as React from 'react';
import { Coins, Copy, Crown, Gift, Share2, Sparkles } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from '@/components/sabcrm/20ui';

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
  const { toast } = useToast();

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
      toast.error('Not enough points');
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
        tone: 'success',
      });
      setRedeemOpen(false);
    } catch (e) {
      toast({
        title: 'Redemption failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        tone: 'danger',
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
      toast.success('Referral link ready');
    } catch (e) {
      toast({
        title: 'Could not generate link',
        description: e instanceof Error ? e.message : 'Unknown error',
        tone: 'danger',
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
      () => toast.success('Link copied'),
      () => toast.error('Copy failed'),
    );
  }, [referralUrl, toast]);

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageEyebrow>Rewards</PageEyebrow>
            <PageTitle>{programName}</PageTitle>
            {programDescription ? (
              <PageDescription>{programDescription}</PageDescription>
            ) : null}
            {referrerCode ? (
              <p className="text-[12px] text-[var(--st-text-secondary)]">
                You arrived via referral code{' '}
                <code className="font-mono text-[var(--st-text)]">{referrerCode}</code>. Your
                inviter will be credited when you qualify.
              </p>
            ) : null}
          </PageHeaderHeading>
        </PageHeader>

        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                <Coins className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] text-[var(--st-text-secondary)]">Your balance</p>
                <p className="text-2xl font-semibold text-[var(--st-text)]">
                  {balance.toLocaleString()} pts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <Crown className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] text-[var(--st-text-secondary)]">Current tier</p>
                <Badge tone="success">{tier}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] text-[var(--st-text-secondary)]">Lifetime points</p>
                <p className="text-base font-semibold text-[var(--st-text)]">
                  {(member?.lifetimePoints ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[var(--st-text)]">Available rewards</h2>
          {catalog.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No rewards available yet"
              description="Check back soon. We are adding redeemable items."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((item) => {
                const affordable = balance >= item.pointsCost;
                return (
                  <Card key={item._id} className="flex flex-col">
                    <div className="flex h-32 w-full items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                      <Gift className="h-10 w-10 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex flex-col gap-1">
                      <h3 className="text-base font-semibold text-[var(--st-text)]">{item.name}</h3>
                      {item.description ? (
                        <p className="text-[12px] text-[var(--st-text-secondary)]">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--st-text)]">
                        {item.pointsCost.toLocaleString()} pts
                      </span>
                      <Button
                        variant="primary"
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
                      <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4" aria-hidden="true" /> Refer a friend
              </CardTitle>
              <CardDescription>
                Share your unique link and earn points when your friends qualify.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {referral ? (
                <div className="flex flex-col gap-2">
                  <Field label="Your referral link">
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={referralUrl}
                        className="font-mono text-[12px]"
                      />
                      <Button variant="outline" iconLeft={Copy} onClick={handleCopy}>
                        Copy
                      </Button>
                    </div>
                  </Field>
                  <p className="text-[12px] text-[var(--st-text-secondary)]">
                    Conversions so far:{' '}
                    <strong>{referral.conversions?.length ?? 0}</strong>, Points earned:{' '}
                    <strong>{(referral.rewardPoints ?? 0).toLocaleString()}</strong>
                  </p>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={generateLink}
                  disabled={!member}
                  loading={referralBusy}
                >
                  Generate my referral link
                </Button>
              )}
            </CardBody>
          </Card>
        </section>
      </div>

      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm redemption</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-[var(--st-text)]">
            {redeemTarget ? (
              <p>
                Redeem <strong>{redeemTarget.name}</strong> for{' '}
                <strong>{redeemTarget.pointsCost.toLocaleString()} points</strong>?
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRedeemOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRedeem} loading={busy}>
              Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
