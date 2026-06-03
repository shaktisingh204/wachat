'use client';

/**
 * SabCRM — Report Builder route (`/sabcrm/reports/builder`).
 *
 * Dedicated full-page surface for composing a new analytics report — the
 * Twenty CRM "report / dashboard builder" parity view, self-written on the
 * SabNode stack (Mongo + Next server actions + ZoruUI).
 *
 * Unlike the slide-in dialog on `/sabcrm/reports`, this page gives the
 * builder its own two-panel canvas (definition form + live preview) with
 * room to breathe. It loads the project's object catalogue once via
 * `listObjectsAction`, then mounts the shared `<ReportBuilder>` component.
 *
 * Save is owned by the builder itself: `<ReportBuilder>` calls
 * `saveReportAction` internally (gate('edit') → Mongo) and invokes the
 * `onSaved` callback we pass with the persisted `SavedReport`. We use that
 * callback to navigate back to the reports list once the report is created.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`; the underlying server action re-runs the full
 * session → project → RBAC → plan gate independently, so direct access
 * fails closed.
 *
 * Client Component: it reads the active project from `useProject`, loads
 * objects on demand, and navigates on save — all of which require the
 * client runtime.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

import {
  Button,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Skeleton,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
} from '@/components/zoruui';

import { useProject } from '@/context/project-context';
import { listObjectsAction } from '@/app/actions/sabcrm.actions';
import type { SavedReport } from '@/app/actions/sabcrm.actions.types';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import { ReportBuilder } from '@/components/sabcrm/report-builder';

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the builder's two-panel layout.
// ---------------------------------------------------------------------------

function BuilderSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-zoru-line p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-zoru-line p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmReportBuilderPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Load the object catalogue once for the active project. Failures surface
  // inline; the gate re-validates inside the action.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageError(null);

    void (async () => {
      const res = await listObjectsAction(activeProjectId ?? undefined);
      if (cancelled) return;

      if (res.ok) {
        setObjects(res.data);
      } else {
        setPageError(res.error);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // The builder owns the save (via saveReportAction). On success it hands us
  // the persisted report — we return to the reports list to view it.
  const handleSaved = React.useCallback(
    (_report: SavedReport) => {
      router.push('/sabcrm/reports');
      router.refresh();
    },
    [router],
  );

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Analytics</ZoruPageEyebrow>
          <ZoruPageTitle>Report Builder</ZoruPageTitle>
          <ZoruPageDescription>
            Compose a new report from any CRM object — pick a metric, group by
            a field or over time, filter the records, and choose how to
            visualise the result. The preview re-runs live against your data
            as you refine the definition; save it to add it to your reports.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button asChild variant="outline" size="sm">
            <Link href="/sabcrm/reports">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to reports
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {loading ? (
        <BuilderSkeleton />
      ) : pageError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Unable to load the report builder</ZoruAlertTitle>
          <ZoruAlertDescription>{pageError}</ZoruAlertDescription>
        </Alert>
      ) : (
        <ReportBuilder
          objects={objects}
          projectId={activeProjectId ?? undefined}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
