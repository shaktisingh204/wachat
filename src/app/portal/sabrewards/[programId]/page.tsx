/**
 * Customer-facing rewards storefront.
 *
 * `/portal/sabrewards/[programId]` — branded redeem surface for the logged-in
 * customer. Shows balance, available rewards (catalog), redemption flow,
 * and a referral link generator with shareable preview.
 *
 * Auth boundary: this page reads the customer session from `getSession()`.
 * Members are looked up by (programId, customerId) on the server.
 */

import 'server-only';
import '@/styles/zoruui.css';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import {
  getRewardsProgram,
  listRewardsCatalog,
  listRewardsMembers,
  listRewardsReferrals,
} from '@/app/actions/rewards.actions';
import { RewardsPortalClient } from './_portal-client';

export default async function CustomerRewardsPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ ref?: string }>;
}): Promise<React.JSX.Element> {
  const { programId } = await params;
  const { ref } = await searchParams;

  const [session, program] = await Promise.all([
    getSession(),
    getRewardsProgram(programId),
  ]);
  if (!program) notFound();

  const customerId = String((session?.user as { _id?: string } | undefined)?._id ?? '');

  const [catalog, allMembers, referrals] = await Promise.all([
    listRewardsCatalog({ programId, activeOnly: true }),
    listRewardsMembers(programId),
    listRewardsReferrals({ programId }),
  ]);

  const member = allMembers.find((m) => m.customerId === customerId) ?? null;
  const myReferral = referrals.find(
    (r) => r.memberId === member?._id && r.active,
  );

  return (
    <RewardsPortalClient
      programName={program.name}
      programDescription={program.description ?? ''}
      member={member}
      catalog={catalog}
      myReferral={myReferral ?? null}
      referrerCode={ref ?? null}
      programId={programId}
    />
  );
}
