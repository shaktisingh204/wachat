/**
 * /dashboard/sabflow/import — single-page importer for n8n + Typebot flows.
 *
 * Auto-detects format by inspecting the uploaded JSON's shape (n8n exports
 * have `nodes` + `connections`; Typebot has `groups` + `events`).  Routes
 * to /api/sabflow/import-n8n or /api/sabflow/import-typebot accordingly
 * and redirects to the new flow on success.
 */

import { Suspense } from 'react';
import { LuLoader } from 'react-icons/lu';
import { ImportClient } from './_components/import-client';

export const dynamic = 'force-dynamic';

export default function ImportPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
          </div>
        }
      >
        <ImportClient />
      </Suspense>
    </div>
  );
}
