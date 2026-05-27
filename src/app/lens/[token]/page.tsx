import { redeemSablensCustomerToken } from '@/app/actions/sablens.actions';

import { CustomerLensClient } from './_components/customer-lens-client';

export const dynamic = 'force-dynamic';

type Params = Promise<{ token: string }>;

export default async function CustomerLensPage({ params }: { params: Params }) {
  const { token } = await params;
  const res = await redeemSablensCustomerToken(token);

  if (!res.ok) {
    return (
      <div className="zoruui flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center text-white">
        <h1 className="text-xl font-semibold">Session link is invalid</h1>
        <p className="mt-2 text-sm text-white/70">
          Ask the technician for a fresh link, then try again.
        </p>
      </div>
    );
  }

  return <CustomerLensClient token={token} session={res.data} />;
}
