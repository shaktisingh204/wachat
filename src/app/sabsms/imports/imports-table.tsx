"use client";

/**
 * SabSMS imports. Main table client component.
 *
 * Composes the page-toolkit primitives (`SabsmsPageShell`,
 * `SabsmsFilterBar`, `SabsmsDataTable`, `SabsmsExportMenu`,
 * `SabsmsDetailDrawer`, `SabsmsRefreshButton`) with the wizard from
 * `wizard.tsx`. Drives the 20 page-unique features for /sabsms/imports.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ListChecks,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  SabsmsExportMenu,
  SabsmsRefreshButton,
  SabsmsDetailDrawer,
  type SabsmsColumn,
  type SabsmsRowAction,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";
import { Badge, Button, Progress, toast } from "@/components/sabcrm/20ui";

import { ImportsWizard } from "./wizard";
import {
  cancelImport,
  createImport,
  deleteImport,
  failedRowsCsv,
  pauseImport,
  resumeImport,
  retryFailedRows,
  rollbackImport,
  type ImportRecord,
  type ImportStatus,
} from "./actions";

export interface ImportsTableProps {
  workspaceId: string;
  initialImports: ImportRecord[];
}

function statusVariant(
  status: ImportStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "secondary";
    case "running":
    case "queued":
      return "default";
    case "paused":
      return "outline";
    case "cancelled":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function ImportsTable({
  workspaceId: _workspaceId,
  initialImports,
}: ImportsTableProps) {
  void _workspaceId;
  const router = useRouter();
  const [imports, setImports] = React.useState<ImportRecord[]>(initialImports);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [drawerImport, setDrawerImport] = React.useState<ImportRecord | null>(
    null,
  );

  React.useEffect(() => {
    setImports(initialImports);
  }, [initialImports]);

  React.useEffect(() => {
    const activeImports = imports.filter(
      (i) => i.status === "queued" || i.status === "running",
    );
    if (activeImports.length === 0) return;

    const eventSources: EventSource[] = [];

    for (const record of activeImports) {
      if (record.status === "queued" || record.status === "running") {
        // Trigger processing
        const es = new EventSource(
          `/api/sabsms/imports/process?id=${record.id}`,
        );

        es.onmessage = () => {
          // generic message? we are listening to specific events
        };

        es.addEventListener("progress", (e) => {
          const data = JSON.parse(e.data);
          setImports((prev) =>
            prev.map((imp) => {
              if (imp.id === record.id) {
                return {
                  ...imp,
                  status: "running",
                  counts: { ...imp.counts, imported: data.processed },
                };
              }
              return imp;
            }),
          );
        });

        es.addEventListener("status", (e) => {
          const data = JSON.parse(e.data);
          setImports((prev) =>
            prev.map((imp) => {
              if (imp.id === record.id) {
                return { ...imp, status: data.status };
              }
              return imp;
            }),
          );
        });

        es.addEventListener("completed", (e) => {
          const data = JSON.parse(e.data);
          setImports((prev) =>
            prev.map((imp) => {
              if (imp.id === record.id) {
                return {
                  ...imp,
                  status: "completed",
                  counts: { ...imp.counts, imported: data.processed },
                };
              }
              return imp;
            }),
          );
          es.close();
          handleRefresh();
        });

        es.addEventListener("error", (e) => {
          console.error("SSE error", e);
          es.close();
        });

        eventSources.push(es);
      }
    }

    return () => {
      for (const es of eventSources) es.close();
    };
  }, [imports.map((i) => i.status).join(",")]); // Only re-run when statuses change

  const handleRefresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  async function withToast(
    label: string,
    fn: () =>
      | Promise<{ ok: true } | { ok: false; error: string }>
      | Promise<{ ok: true; id: string } | { ok: false; error: string }>,
  ) {
    const result = await fn();
    if (result.ok) {
      toast.success(`${label} succeeded.`);
      handleRefresh();
    } else {
      toast.error(`${label} failed: ${result.error}`);
    }
  }

  const columns: SabsmsColumn<ImportRecord>[] = [
    {
      id: "name",
      header: "Name",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-0 font-medium text-[var(--st-text)] hover:underline"
          onClick={() => setDrawerImport(r)}
        >
          {r.name}
        </Button>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
      ),
    },
    {
      id: "progress",
      header: "Progress",
      render: (r) => {
        const pct =
          r.counts.total > 0
            ? Math.round(
                ((r.counts.imported + r.counts.failed + r.counts.skipped) /
                  r.counts.total) *
                  100,
              )
            : 0;
        return (
          <div className="min-w-[140px] space-y-1">
            <Progress value={pct} size="sm" />
            <p className="text-[10px] text-[var(--st-text)]">
              {r.counts.imported.toLocaleString()} /{" "}
              {r.counts.total.toLocaleString()}
              {r.counts.failed > 0 && (
                <span className="ml-1 text-[var(--st-text)]">
                  ({r.counts.failed.toLocaleString()} failed)
                </span>
              )}
            </p>
          </div>
        );
      },
    },
    {
      id: "tags",
      header: "Tags",
      render: (r) =>
        r.options.bulkTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.options.bulkTags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
            {r.options.bulkTags.length > 3 && (
              <span className="text-[10px] text-[var(--st-text)]">
                +{r.options.bulkTags.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">-</span>
        ),
    },
    {
      id: "cost",
      header: "Cost",
      align: "right",
      render: (r) =>
        r.costEstimate ? (
          <span className="text-xs tabular-nums">
            ${r.costEstimate.amount.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">-</span>
        ),
    },
    {
      id: "createdAt",
      header: "Created",
      render: (r) => (
        <span className="text-xs text-[var(--st-text)]">
          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
        </span>
      ),
    },
  ];

  const rowActions: SabsmsRowAction<ImportRecord>[] = [
    {
      label: "View details",
      icon: <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => setDrawerImport(r),
    },
    {
      label: "Pause",
      icon: <Pause className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => withToast("Pause", () => pauseImport(r.id)),
    },
    {
      label: "Resume",
      icon: <Play className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => withToast("Resume", () => resumeImport(r.id)),
    },
    {
      label: "Cancel",
      icon: <X className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => withToast("Cancel", () => cancelImport(r.id)),
    },
    {
      label: "Retry failed rows",
      icon: <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => withToast("Retry", () => retryFailedRows(r.id)),
    },
    {
      label: "Rollback",
      icon: <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />,
      onSelect: (r) => withToast("Rollback", () => rollbackImport(r.id)),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
      destructive: true,
      onSelect: (r) => withToast("Delete", () => deleteImport(r.id)),
    },
  ];

  return (
    <SabsmsPageShell
      eyebrow="Contacts"
      title="Imports"
      description="Bring contacts into SabSMS from CSV. Drag-drop via SabFiles, map columns, preview normalisation, and watch the import run."
      breadcrumbs={[{ label: "Imports" }]}
      primaryAction={{
        label: "New import",
        onClick: () => setWizardOpen(true),
      }}
      helpTitle="About imports"
      helpBody={
        <ul className="list-disc space-y-1 pl-4 text-xs">
          <li>Every CSV must come from SabFiles, no external URLs.</li>
          <li>
            Phone numbers are normalised to E.164; rows that fail validation
            are written to a per-import failure CSV.
          </li>
          <li>
            Marketing imports require an explicit consent attestation before
            they can be queued.
          </li>
        </ul>
      }
      secondaryActions={[
        {
          label: "Mapping templates",
          icon: <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />,
        },
        {
          label: "Schedules",
          icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />,
        },
      ]}
      toolbar={
        <SabsmsFilterBar
          searchPlaceholder="Search imports by name..."
          facets={[
            {
              key: "status",
              label: "Status",
              multi: true,
              options: [
                { value: "queued", label: "Queued" },
                { value: "running", label: "Running" },
                { value: "paused", label: "Paused" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "failed", label: "Failed" },
              ],
            },
          ]}
          dateRangeKey={{ from: "from", to: "to" }}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "largest", label: "Largest first" },
          ]}
          defaultSort="newest"
          trailing={
            <>
              <SabsmsRefreshButton onRefresh={handleRefresh} />
              <SabsmsExportMenu
                filename="sabsms-imports"
                toCsv={async () =>
                  rowsToCsv(
                    imports.map((i) => ({
                      name: i.name,
                      status: i.status,
                      total: i.counts.total,
                      imported: i.counts.imported,
                      failed: i.counts.failed,
                      createdAt: i.createdAt,
                    })),
                    [
                      { key: "name", header: "Name" },
                      { key: "status", header: "Status" },
                      { key: "total", header: "Total" },
                      { key: "imported", header: "Imported" },
                      { key: "failed", header: "Failed" },
                      { key: "createdAt", header: "Created" },
                    ],
                  )
                }
              />
            </>
          }
        />
      }
    >
      <SabsmsDataTable<ImportRecord>
        rows={imports}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        rowActions={rowActions}
        bulkActions={[
          {
            label: "Cancel selected",
            icon: <X className="h-3.5 w-3.5" aria-hidden="true" />,
            onSelect: async (rows) => {
              await Promise.all(rows.map((r) => cancelImport(r.id)));
              toast.success(`Cancelled ${rows.length} import(s).`);
              handleRefresh();
            },
          },
          {
            label: "Delete selected",
            icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
            destructive: true,
            onSelect: async (rows) => {
              await Promise.all(rows.map((r) => deleteImport(r.id)));
              toast.success(`Deleted ${rows.length} import(s).`);
              setSelectedIds([]);
              handleRefresh();
            },
          },
        ]}
        emptyTitle="No imports yet"
        emptyDescription="Run your first CSV import to bring contacts into SabSMS."
        emptyAction={{
          label: "New import",
          onClick: () => setWizardOpen(true),
        }}
      />

      <ImportsWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSubmit={createImport}
        lastImport={imports[0]}
      />

      <SabsmsDetailDrawer
        open={drawerImport !== null}
        onOpenChange={(o) => !o && setDrawerImport(null)}
        title={drawerImport?.name ?? "Import"}
        description={
          drawerImport ? `Audit trail and failed-row download` : undefined
        }
      >
        {drawerImport && (
          <ImportDetail
            record={drawerImport}
            onDownloadFailures={async () =>
              failedRowsCsv(drawerImport.workspaceId, drawerImport.id)
            }
          />
        )}
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}

function ImportDetail({
  record,
  onDownloadFailures,
}: {
  record: ImportRecord;
  onDownloadFailures: () => Promise<string>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <DetailField label="Status" value={record.status} />
        <DetailField label="Source" value={record.source} />
        <DetailField
          label="Total rows"
          value={record.counts.total.toLocaleString()}
        />
        <DetailField
          label="Imported"
          value={record.counts.imported.toLocaleString()}
        />
        <DetailField
          label="Failed"
          value={record.counts.failed.toLocaleString()}
        />
        <DetailField
          label="Skipped"
          value={record.counts.skipped.toLocaleString()}
        />
        {record.options.cronExpression && (
          <DetailField label="Cron" value={record.options.cronExpression} />
        )}
        {record.options.webhookUrl && (
          <DetailField label="Webhook" value={record.options.webhookUrl} />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--st-text)]">
          Failed rows
        </h3>
        {record.counts.failed > 0 ? (
          <SabsmsExportMenu
            filename={`sabsms-import-${record.id}-failures`}
            toCsv={onDownloadFailures}
          />
        ) : (
          <p className="text-xs text-[var(--st-text)]">No failed rows.</p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--st-text)]">
          Audit trail
        </h3>
        <ol className="space-y-2">
          {record.audit.map((evt, i) => (
            <li
              key={i}
              className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2 text-xs"
            >
              <div className="font-medium text-[var(--st-text)]">
                {evt.kind}
              </div>
              {evt.message && (
                <div className="text-[var(--st-text)]">{evt.message}</div>
              )}
              <div className="mt-0.5 text-[10px] text-[var(--st-text-secondary)]">
                {new Date(evt.at).toLocaleString()}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--st-text)]">
        {label}
      </div>
      <div className="text-sm text-[var(--st-text)]">{value}</div>
    </div>
  );
}
