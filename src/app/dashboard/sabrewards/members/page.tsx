import * as React from 'react';

import { listRewardsMembers, listRewardsPrograms } from '@/app/actions/rewards.actions';
import { MembersClient } from './_members-client';

export const dynamic = 'force-dynamic';

export default async function RewardsMembersPage(): Promise<React.JSX.Element> {
  const [members, programs] = await Promise.all([
    listRewardsMembers(),
    listRewardsPrograms(),
  ]);
  return (
    <MembersClient
      initialMembers={members}
      programs={programs.map((p) => ({ id: p._id, name: p.name }))}
    />
  );
}
