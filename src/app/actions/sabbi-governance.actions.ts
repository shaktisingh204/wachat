'use server';

/** SabBI governance actions — verify / unverify a semantic model. */

import { revalidatePath } from 'next/cache';

import { getGovernanceMap, setVerified, type Governance } from '@/lib/sabbi/governance.server';

export async function getGovernanceMapAction(): Promise<Record<string, Governance>> {
  return getGovernanceMap();
}

export async function setVerifiedAction(modelId: string, verified: boolean) {
  await setVerified(modelId, verified);
  revalidatePath('/dashboard/sabbi/models');
  revalidatePath(`/dashboard/sabbi/models/${modelId}`);
}
