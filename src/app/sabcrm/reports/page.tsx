/**
 * SabCRM — Reports route (`/sabcrm/reports`).
 *
 * Server Component entry. Fetches the saved-reports list and the object
 * catalogue in parallel (each call independently runs the full
 * session → project → RBAC → plan gate), then hands off to the
 * `<ReportsClient>` interactive shell.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent layout.tsx;
 * this page fails closed (shows an inline error state) for any user who
 * slips past the layout guard, because the gate in each server action
 * re-validates independently.
 */

import * as React from 'react';
import type { Metadata } from 'next';

import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from '@/components/zoruui';
import {
  listObjectsAction,
  listReportsAction,
} from '@/app/actions/sabcrm.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import type { SavedReport } from '@/app/actions/sabcrm.actions';

import { ReportsClient } from './reports-client';

export const metadata: Metadata = {
  title: 'Reports — SabCRM',
  description: 'Build, save, and run analytics reports across your CRM data.',
};

// Reports are project-scoped and live-run; never cache.
export const dynamic = 'force-dynamic';

export default async function SabcrmReportsPage() {
  // Fetch objects catalogue and saved reports in parallel. Each gate() call
  // re-validates the session independently; failures surface as inline states.
  const [objectsRes, reportsRes] = await Promise.all([
    listObjectsAction(),
    listReportsAction(),
  ]);

  const objects: ObjectMetadata[] = objectsRes.ok ? objectsRes.data : [];
  const initialReports: SavedReport[] = reportsRes.ok ? reportsRes.data : [];

  // Surface the first gate failure as the error prop. Objects failure is
  // less critical — the builder just shows an empty list. Reports failure
  // is shown as the page-level error.
  const initialError: string | undefined = !reportsRes.ok
    ? reportsRes.error
    : undefined;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Analytics</ZoruPageEyebrow>
          <ZoruPageTitle>Reports</ZoruPageTitle>
          <ZoruPageDescription>
            Build analytics reports across any CRM object — count records, sum
            values, and visualise trends by group or over time. Results are
            computed live from your data each time you run a report.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions />
      </PageHeader>

      <ReportsClient
        objects={objects}
        initialReports={initialReports}
        initialError={initialError}
      />
    </main>
  );
}
