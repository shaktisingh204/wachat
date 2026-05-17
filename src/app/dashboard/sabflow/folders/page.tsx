/**
 * /dashboard/sabflow/folders — manage SabFlow folder records.
 *
 * Thin server shell; CRUD interactions live in `FoldersClient`, which
 * talks directly to the REST endpoints under `/api/sabflow/folders`.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { FoldersClient } from './_components/folders-client';

export const dynamic = 'force-dynamic';

export default function FoldersPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <FoldersClient />
      </Suspense>
    </div>
  );
}
