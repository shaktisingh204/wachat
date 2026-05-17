/**
 * /dashboard/sabflow/credentials/[id]/scopes — OAuth scope inspector.
 *
 * Renders the scope list for a single OAuth credential, with provider-aware
 * descriptions plus re-authorise + revoke actions.  Mirrors the thin server
 * shell pattern from `executions/[executionId]/page.tsx`.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { ScopesClient } from './_components/scopes-client';

export const dynamic = 'force-dynamic';

export default async function CredentialScopesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <ScopesClient credentialId={id} />
      </Suspense>
    </div>
  );
}
