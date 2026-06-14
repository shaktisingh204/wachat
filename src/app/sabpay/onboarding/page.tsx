import { redirect } from 'next/navigation';

import { getMyKyc } from '@/app/actions/sabpay-kyc.actions';

import { OnboardingClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function SabpayOnboardingPage() {
  const kyc = await getMyKyc();
  if (kyc?.status === 'verified') redirect('/sabpay');
  return <OnboardingClient initial={kyc} />;
}
