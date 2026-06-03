'use client';

/**
 * SabCRM — Import & Export settings page (`/sabcrm/settings/import-export`).
 *
 * Twenty CRM "Import / Export records" parity, self-written on the SabNode
 * stack (Mongo + Next server-actions + ZoruUI):
 *
 *   1. Loads the active project's object schema via `listObjectsAction`
 *      (the same gated action the object index pages use). The action runs
 *      the full session → project → RBAC → plan pipeline and returns an
 *      `ActionResult<ObjectMetadata[]>` (`{ ok, data } | { ok, error }`),
 *      so the page fails closed into an error state.
 *   2. Renders a ZoruUI `Select` to pick the target object (standard or
 *      custom). Import and Export both operate on a single chosen object,
 *      mirroring Twenty's per-object import/export flow.
 *   3. Wires the chosen object into:
 *        - `<ImportDialog>` — the four-step CSV/XLSX upload wizard.
 *        - `<ExportButton>` — CSV / XLSX download of the object's records.
 *      Both receive the resolved `ObjectMetadata` and the active `projectId`.
 *
 * Auth / onboarding / project-context guards are enforced by the parent
 * SabCRM `layout.tsx`; the actions enforce RBAC + plan independently.
 *
 * Design constraints:
 *   - ZoruUI primitives only (`@/components/zoruui`). No Tailwind accents,
 *     no clay/ui. File inputs inside the dialog come from SabFiles.
 *   - Strict TS against the real `ImportDialogProps`, `ExportButtonProps`,
 *     and `ActionResult<ObjectMetadata[]>` shapes.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, Database, AlertTriangle } from 'lucide-react';

import {
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
  Label,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
} from '@/components/zoruui';
import { ImportDialog } from '@/components/sabcrm/import-dialog';
import { ExportButton } from '@/components/sabcrm/export-button';
import { listObjectsAction } from '@/app/actions/sabcrm.actions';
import { useProject } from '@/context/project-context';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import type { ImportBatchResult } from '@/lib/sabcrm/import-export.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_BASE_PATH = '/sabcrm';
const SETTINGS_PATH = `${CRM_BASE_PATH}/settings`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmImportExportPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = React.useState<string>('');
  const [importOpen, setImportOpen] = React.useState(false);

  // Load the object schema for the active project. Re-runs on project switch.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const res = await listObjectsAction(activeProjectId ?? undefined);
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error);
        setObjects([]);
        setLoading(false);
        return;
      }

      setObjects(res.data);
      // Reset the selection if it no longer exists in the new schema.
      setSelectedSlug((prev) =>
        res.data.some((o) => o.slug === prev) ? prev : '',
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const selectedObject = React.useMemo<ObjectMetadata | null>(
    () => objects.find((o) => o.slug === selectedSlug) ?? null,
    [objects, selectedSlug],
  );

  const handleImported = React.useCallback((_result: ImportBatchResult) => {
    // The dialog owns its own success summary; nothing on this settings page
    // needs to refresh, so we simply close the wizard.
    setImportOpen(false);
  }, []);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-4xl px-6 py-10 sm:px-8 sm:py-14">
      {/* Page heading */}
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            <Link
              href={CRM_BASE_PATH}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              SabCRM
            </Link>
            <span className="mx-1 text-zoru-ink-muted">/</span>
            <Link
              href={SETTINGS_PATH}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              Settings
            </Link>
            <span className="mx-1 text-zoru-ink-muted">/</span>
            Import &amp; Export
          </ZoruPageEyebrow>
          <ZoruPageTitle>Import &amp; Export</ZoruPageTitle>
          <ZoruPageDescription>
            Bulk-load records into any object from a CSV or XLSX file, or export
            an object&apos;s records back out for spreadsheets, backups, and
            external tools. Pick an object to begin — imports run through a
            guided column-mapping wizard.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Separator className="my-6" />

      {/* Hard load failure — actions failed closed (RBAC / plan / session). */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Unable to load objects</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {/* Object picker */}
      <Card>
        <CardHeader>
          <CardTitle>Target object</CardTitle>
          <CardDescription>
            Choose which object the import and export should operate on.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full max-w-sm" />
            </div>
          ) : objects.length === 0 && !error ? (
            <EmptyState
              icon={<Database className="h-5 w-5" aria-hidden />}
              title="No objects available"
              description="This project has no CRM objects to import into or export from yet."
            />
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-export-object">Object</Label>
              <Select value={selectedSlug} onValueChange={setSelectedSlug}>
                <SelectTrigger id="import-export-object" className="w-full max-w-sm">
                  <SelectValue placeholder="Select an object…" />
                </SelectTrigger>
                <SelectContent>
                  {objects.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.labelPlural}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Import / Export actions — only once an object is chosen. */}
          {selectedObject ? (
            <>
              <Separator />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-zoru-ink">
                    <ArrowDownToLine className="h-4 w-4 text-zoru-ink-muted" aria-hidden />
                    Import {selectedObject.labelPlural.toLowerCase()}
                  </div>
                  <p className="text-sm text-zoru-ink-muted">
                    Upload a CSV or XLSX file, map its columns to{' '}
                    {selectedObject.labelSingular.toLowerCase()} fields, preview, and commit.
                  </p>
                </div>
                <Button onClick={() => setImportOpen(true)}>
                  <ArrowDownToLine className="h-4 w-4" aria-hidden />
                  Import
                </Button>
              </div>

              <Separator />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-zoru-ink">
                    <ArrowUpFromLine className="h-4 w-4 text-zoru-ink-muted" aria-hidden />
                    Export {selectedObject.labelPlural.toLowerCase()}
                  </div>
                  <p className="text-sm text-zoru-ink-muted">
                    Download this object&apos;s records as a CSV or XLSX file.
                  </p>
                </div>
                <ExportButton
                  object={selectedObject}
                  projectId={activeProjectId ?? undefined}
                />
              </div>

              {/* Import wizard — controlled open state. */}
              <ImportDialog
                object={selectedObject}
                open={importOpen}
                onOpenChange={setImportOpen}
                projectId={activeProjectId ?? undefined}
                onImported={handleImported}
              />
            </>
          ) : (
            !loading &&
            objects.length > 0 && (
              <p className="text-sm text-zoru-ink-muted">
                Select an object above to import or export its records.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </main>
  );
}
