import * as React from 'react';

import { listRewardsReferrals, listRewardsPrograms, listRewardsMembers } from '@/app/actions/rewards.actions';
import { ReferralsClient } from './_referrals-client';

export const dynamic = 'force-dynamic';

export default async function RewardsReferralsPage(): Promise<React.JSX.Element> {
  const [referrals, programs, members] = await Promise.all([
    listRewardsReferrals(),
    listRewardsPrograms(),
    listRewardsMembers(),
  ]);
  return (
    <ReferralsClient
      initialReferrals={referrals}
      programs={programs.map((p) => ({ id: p._id, name: p.name }))}
      members={members.map((m) => ({
        id: m._id,
        label: `Customer ${m.customerId.slice(-6)}`,
      }))}
    />
  );
}
