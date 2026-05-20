import { getPendingSignups } from '@/app/actions/client-signup.actions';
import { PendingApprovalsClient } from './pending-approvals-client';

export const dynamic = 'force-dynamic';

export default async function PendingApprovalsPage() {
  let initial: Awaited<ReturnType<typeof getPendingSignups>> | null = null;
  let error: string | null = null;
  try {
    initial = await getPendingSignups();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : 'Failed to load pending signups.';
  }

  return (
    <PendingApprovalsClient
      initialRows={initial?.rows ?? []}
      initialKpis={initial?.kpis ?? { totalPending: 0, oldestDays: 0 }}
      loadError={error}
    />
  );
}
