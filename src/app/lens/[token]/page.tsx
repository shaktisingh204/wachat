import { Unlink } from 'lucide-react';

import { redeemSablensCustomerToken } from '@/app/actions/sablens.actions';
import { EmptyState } from '@/components/sabcrm/20ui';

import { CustomerLensClient } from './_components/customer-lens-client';

export const dynamic = 'force-dynamic';

type Params = Promise<{ token: string }>;

export default async function CustomerLensPage({ params }: { params: Params }) {
  const { token } = await params;
  const res = await redeemSablensCustomerToken(token);

  if (!res.ok) {
    return (
      <div className="ui20 flex min-h-screen flex-col items-center justify-center bg-[var(--st-bg)] p-6 text-center">
        <EmptyState
          icon={Unlink}
          tone="danger"
          title="Session link is invalid"
          description="Ask the technician for a fresh link, then try again."
        />
      </div>
    );
  }

  return <CustomerLensClient token={token} session={res.data} />;
}
