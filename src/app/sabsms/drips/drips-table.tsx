"use client";

/**
 * Drips list — client table.
 *
 * Backs Page 12 §B.2 of `plans/sabsms-pages-catalog.md`. Composes the
 * SabSMS page toolkit primitives (filter bar, data table, bulk
 * actions, export menu, detail drawer) with the 20 page-specific
 * features for drips.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Copy,
  Download,
  Edit3,
  ListPlus,
  LogOut,
  PauseCircle,
  PlayCircle,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Recharts, ChartContainer, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Switch } from '@/components/sabcrm/20ui';
import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsKbdHint,
  SabsmsRefreshButton,
  rowsToCsv,
  type SabsmsBulkAction,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";
import { SabFilePickerButton } from "@/components/sabfiles";

import {
  bulkEnrolFromSegment,
  duplicateDrip,
  editSchedule,
  exportDripJson,
  importDripJson,
  massExit,
  setAutoPauseOnError,
  setDripEnabledFromList,
  testEnrolContact,
  type DripRow,
} from "./actions";

interface DripsTableProps {
  rows: DripRow[];
  templateOptions: Array<{ value: string; label: string }>;
}

export function DripsTable({ rows, templateOptions }: DripsTableProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [drawerRow, setDrawerRow] = React.useState<DripRow | null>(null);
  const [testEnrolFor, setTestEnrolFor] = React.useState<DripRow | null>(null);
  const [scheduleFor, setScheduleFor] = React.useState<DripRow | null>(null);
  const [bulkEnrolOpen, setBulkEnrolOpen] = React.useState<DripRow[] | null>(null);
  const [confirmExit, setConfirmExit] = React.useState<DripRow[] | null>(null);

  // ── Row actions ────────────────────────────────────────────────────
  const rowActions: SabsmsRowAction<DripRow>[] = [
    {
      label: "Pause / resume",
      icon: <PauseCircle className="h-3.5 w-3.5" />,
      onSelect: async (row) => {
        await setDripEnabledFromList(row.id, !row.enabled);
        router.refresh();
      },
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: async (row) => {
        const res = await duplicateDrip(row.id);
        if (res.ok && res.id) router.push(`/sabsms/drips/${res.id}`);
      },
    },
    {
      label: "Edit schedule",
      icon: <Edit3 className="h-3.5 w-3.5" />,
      onSelect: (row) => setScheduleFor(row),
    },
    {
      label: "Test enrol",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      onSelect: (row) => setTestEnrolFor(row),
    },
    {
      label: "Export JSON",
      icon: <Download className="h-3.5 w-3.5" />,
      onSelect: async (row) => {
        const res = await exportDripJson(row.id);
        if (res.ok && res.json) {
          const blob = new Blob([res.json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `drip-${row.id}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      },
    },
  ];

  // ── Bulk actions ───────────────────────────────────────────────────
  const bulkActions: SabsmsBulkAction<DripRow>[] = [
    {
      label: "Bulk enrol from segment",
      icon: <ListPlus className="h-3.5 w-3.5" />,
      onSelect: (selRows) => setBulkEnrolOpen(selRows),
    },
    {
      label: "Mass exit (remove all contacts)",
      icon: <LogOut className="h-3.5 w-3.5" />,
      destructive: true,
      onSelect: (selRows) => setConfirmExit(selRows),
    },
  ];

  // ── Columns ────────────────────────────────────────────────────────
  const columns: SabsmsColumn<DripRow>[] = [
    {
      id: "name",
      header: "Name",
      width: "minmax(220px, 1.5fr)",
      render: (r) => (
        <div className="space-y-0.5">
          <Link
            href={`/sabsms/drips/${r.id}`}
            className="font-medium text-[var(--st-text)] hover:text-[var(--st-text)]"
          >
            {r.name}
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--st-text)]">
            <span>{r.stepCount} steps</span>
            <span className="text-[var(--st-text-secondary)]">·</span>
            <MiniDots count={r.stepCount} branchCount={r.branchCount} />
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "110px",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.enabled ? (
            <Badge>
              <PlayCircle className="mr-1 h-3 w-3" /> Running
            </Badge>
          ) : (
            <Badge variant="secondary">
              <PauseCircle className="mr-1 h-3 w-3" /> Paused
            </Badge>
          )}
          {r.errorCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertCircle className="mr-0.5 h-3 w-3" /> {r.errorCount}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "trigger",
      header: "Trigger",
      width: "120px",
      render: (r) => (
        <Badge variant="secondary" className="text-[10px]">
          {r.triggerLabel}
        </Badge>
      ),
    },
    {
      id: "active",
      header: "Active",
      width: "100px",
      align: "right",
      render: (r) => (
        <span className="flex items-center justify-end gap-1 font-mono text-xs">
          <Users className="h-3 w-3 text-[var(--st-text-secondary)]" />
          {r.activeRecipients.toLocaleString()}
        </span>
      ),
    },
    {
      id: "throughput",
      header: "Throughput",
      width: "120px",
      align: "right",
      render: (r) => (
        <span className="flex items-center justify-end gap-1 font-mono text-xs">
          <Zap className="h-3 w-3 text-[var(--st-text)]" />
          {r.throughputPerMin.toFixed(1)}/min
        </span>
      ),
    },
    {
      id: "conversion",
      header: "Conversion",
      width: "110px",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs">
          {(r.conversionRate * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      id: "branches",
      header: "Branches",
      width: "90px",
      align: "right",
      render: (r) => <span className="font-mono text-xs">{r.branchCount}</span>,
    },
    {
      id: "cohort",
      header: "Cohort",
      width: "120px",
      hideByDefault: true,
      render: (r) => (
        <span className="text-xs text-[var(--st-text)]">{r.cohort ?? "—"}</span>
      ),
    },
    {
      id: "autoPause",
      header: "Auto-pause",
      width: "110px",
      hideByDefault: true,
      render: (r) => (
        <Switch
          checked={r.autoPauseOnError}
          onCheckedChange={async (v) => {
            await setAutoPauseOnError(r.id, !!v);
            router.refresh();
          }}
          aria-label="Auto-pause on error"
        />
      ),
    },
    {
      id: "updated",
      header: "Updated",
      width: "150px",
      render: (r) => (
        <span className="text-xs text-[var(--st-text)]">
          {new Date(r.updatedAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const totalActive = rows.reduce((s, r) => s + r.activeRecipients, 0);
  const totalErrored = rows.filter((r) => r.errorCount > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total drips" value={rows.length} />
        <SummaryCard label="Running" value={rows.filter((r) => r.enabled).length} />
        <SummaryCard label="Active enrolments" value={totalActive} />
        <SummaryCard label="With errors" value={totalErrored} tone="warning" />
      </div>

      <SabsmsFilterBar
        searchPlaceholder="Search drips…"
        facets={[
          {
            key: "enabled",
            label: "Status",
            options: [
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Disabled" },
            ],
          },
          {
            key: "trigger",
            label: "Trigger",
            multi: true,
            options: [
              { value: "manual", label: "Manual" },
              { value: "segment_join", label: "Segment join" },
              { value: "event", label: "Event" },
            ],
          },
          {
            key: "templateId",
            label: "Template",
            options: templateOptions,
          },
          {
            key: "withErrors",
            label: "Errors",
            options: [{ value: "1", label: "Show drips with errors" }],
          },
        ]}
        sortOptions={[
          { value: "newest", label: "Recently updated" },
          { value: "oldest", label: "Oldest first" },
          { value: "name", label: "Name (A-Z)" },
          { value: "active_recipients", label: "Most active" },
        ]}
        defaultSort="newest"
        trailing={
          <div className="flex items-center gap-2">
            <ImportDripButton onImported={() => router.refresh()} />
            <SabsmsExportMenu
              filename="sabsms-drips"
              toCsv={async () =>
                rowsToCsv(
                  rows.map((r) => ({
                    id: r.id,
                    name: r.name,
                    enabled: r.enabled ? "yes" : "no",
                    trigger: r.triggerLabel,
                    active: r.activeRecipients,
                    throughput: r.throughputPerMin,
                    conversion: r.conversionRate,
                    branches: r.branchCount,
                    errors: r.errorCount,
                  })),
                  [
                    { key: "id", header: "ID" },
                    { key: "name", header: "Name" },
                    { key: "enabled", header: "Enabled" },
                    { key: "trigger", header: "Trigger" },
                    { key: "active", header: "Active" },
                    { key: "throughput", header: "Throughput / min" },
                    { key: "conversion", header: "Conversion" },
                    { key: "branches", header: "Branches" },
                    { key: "errors", header: "Errors" },
                  ],
                )
              }
              toJson={async () => rows.map((r) => JSON.stringify(r)).join("\n")}
            />
            <SabsmsRefreshButton onRefresh={() => router.refresh()} defaultInterval={30} />
            <SabsmsKbdHint
              shortcuts={[
                { keys: ["?"], description: "Open this help" },
                { keys: ["N"], description: "New drip" },
              ]}
            />
          </div>
        }
      />

      <SabsmsDataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        rowActions={rowActions}
        bulkActions={bulkActions}
        onRowClick={(r) => setDrawerRow(r)}
        emptyTitle="No drips yet"
        emptyDescription="Build your first drip to start nurturing contacts on auto-pilot."
        emptyAction={{ label: "New drip", href: "/sabsms/drips/new" }}
      />

      {/* ── Detail drawer ─────────────────────────────────────── */}
      <SabsmsDetailDrawer
        open={!!drawerRow}
        onOpenChange={(o) => !o && setDrawerRow(null)}
        title={drawerRow?.name ?? ""}
        description={drawerRow ? `Trigger · ${drawerRow.triggerLabel}` : undefined}
      >
        {drawerRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Detail label="Active" value={drawerRow.activeRecipients.toLocaleString()} />
              <Detail
                label="Throughput"
                value={`${drawerRow.throughputPerMin.toFixed(2)} / min`}
              />
              <Detail
                label="Conversion"
                value={`${(drawerRow.conversionRate * 100).toFixed(1)}%`}
              />
              <Detail label="Branches" value={String(drawerRow.branchCount)} />
              <Detail label="Steps" value={String(drawerRow.stepCount)} />
              <Detail label="Cohort" value={drawerRow.cohort ?? "—"} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Stage drop-off</CardTitle>
                <CardDescription>
                  Delivered count per step.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <DropoffChart rows={drawerRow.stageDropoff} />
              </CardBody>
            </Card>
            <div className="flex items-center gap-2">
              <Button asChild>
                <Link href={`/sabsms/drips/${drawerRow.id}`}>Open builder</Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await setDripEnabledFromList(drawerRow.id, !drawerRow.enabled);
                  router.refresh();
                  setDrawerRow(null);
                }}
              >
                {drawerRow.enabled ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setTestEnrolFor(drawerRow)}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Test enrol
              </Button>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* ── Test enrol dialog ─────────────────────────────────── */}
      <TestEnrolDialog
        row={testEnrolFor}
        onOpenChange={(o) => !o && setTestEnrolFor(null)}
        onSubmit={async (contact) => {
          if (testEnrolFor) {
            await testEnrolContact(testEnrolFor.id, contact);
            setTestEnrolFor(null);
            router.refresh();
          }
        }}
      />

      {/* ── Edit schedule dialog ──────────────────────────────── */}
      <EditScheduleDialog
        row={scheduleFor}
        onOpenChange={(o) => !o && setScheduleFor(null)}
        onSubmit={async (summary) => {
          if (scheduleFor) {
            await editSchedule(scheduleFor.id, summary);
            setScheduleFor(null);
            router.refresh();
          }
        }}
      />

      {/* ── Bulk enrol dialog ─────────────────────────────────── */}
      <BulkEnrolDialog
        rows={bulkEnrolOpen}
        onOpenChange={(o) => !o && setBulkEnrolOpen(null)}
        onSubmit={async (segmentId) => {
          if (bulkEnrolOpen) {
            await bulkEnrolFromSegment(
              bulkEnrolOpen.map((r) => r.id),
              segmentId,
            );
            setBulkEnrolOpen(null);
            setSelected([]);
            router.refresh();
          }
        }}
      />

      {/* ── Mass-exit confirm ─────────────────────────────────── */}
      <AlertDialog
        open={!!confirmExit}
        onOpenChange={(o) => !o && setConfirmExit(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove all contacts from {confirmExit?.length} drip
              {confirmExit?.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Active enrolments will be flushed to zero and an audit event is
              recorded. The drip definitions stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmExit) {
                  await massExit(confirmExit.map((r) => r.id));
                  setConfirmExit(null);
                  setSelected([]);
                  router.refresh();
                }
              }}
            >
              Mass exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <Card
      className={
        tone === "warning" && value > 0
          ? "border-[var(--st-border)] bg-[var(--st-bg-muted)]/60"
          : undefined
      }
    >
      <CardBody className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-[var(--st-text)]">
          {label}
        </div>
        <div className="mt-0.5 text-2xl font-semibold text-[var(--st-text)]">
          {value.toLocaleString()}
        </div>
      </CardBody>
    </Card>
  );
}

function MiniDots({ count, branchCount }: { count: number; branchCount: number }) {
  // Visual mini preview: one dot per step, branch dots gilded.
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: Math.min(count, 12) }).map((_, i) => {
        const isBranch = i < branchCount;
        return (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              isBranch ? "bg-[var(--st-text)]" : "bg-[var(--st-bg-muted)]"
            }`}
            aria-hidden
          />
        );
      })}
      {count > 12 && <span className="ml-0.5 text-[10px] text-[var(--st-text-secondary)]">+{count - 12}</span>}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--st-border)] bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--st-text)]">{label}</div>
      <div className="mt-0.5 font-medium text-[var(--st-text)]">{value}</div>
    </div>
  );
}

function DropoffChart({
  rows,
}: {
  rows: Array<{ step: number; delivered: number }>;
}) {
  if (rows.length === 0) {
    return <div className="text-xs text-[var(--st-text)]">No data yet.</div>;
  }
  return (
    <ChartContainer height={180}>
      <Recharts.BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <Recharts.CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <Recharts.XAxis dataKey="step" tick={{ fontSize: 11 }} />
        <Recharts.YAxis tick={{ fontSize: 11 }} width={28} />
        <Recharts.Tooltip />
        <Recharts.Bar dataKey="delivered" fill="var(--st-text)" />
      </Recharts.BarChart>
    </ChartContainer>
  );
}

function ImportDripButton({ onImported }: { onImported: () => void }) {
  return (
    <SabFilePickerButton
      variant="outline"
      accept="document"
      onPick={async (pick) => {
        try {
          const res = await fetch(pick.url);
          const text = await res.text();
          const result = await importDripJson(text);
          if (result.ok) onImported();
        } catch {
          // The picker already showed an error toast; nothing to do.
        }
      }}
    >
      <Upload className="mr-1.5 h-3.5 w-3.5" /> Import JSON
    </SabFilePickerButton>
  );
}

function TestEnrolDialog({
  row,
  onOpenChange,
  onSubmit,
}: {
  row: DripRow | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (contact: { phoneE164: string; firstName?: string }) => Promise<void>;
}) {
  const [phone, setPhone] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const open = !!row;
  React.useEffect(() => {
    if (!open) {
      setPhone("");
      setFirstName("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test enrol a contact</DialogTitle>
          <DialogDescription>
            The contact joins {row?.name} as a one-shot test enrolment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label>Phone (E.164)</Label>
            <Input
              placeholder="+15555550100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>First name (optional)</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ phoneE164: phone, firstName: firstName || undefined })}
            disabled={!phone}
          >
            Enrol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditScheduleDialog({
  row,
  onOpenChange,
  onSubmit,
}: {
  row: DripRow | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (summary: string) => Promise<void>;
}) {
  const [summary, setSummary] = React.useState("");
  const open = !!row;
  React.useEffect(() => {
    if (open && row) setSummary(row.scheduleSummary);
  }, [open, row]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>
            Short human-readable summary surfaced in the list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Schedule summary</Label>
          <Input
            placeholder="e.g. Daily 09:00 in contact TZ"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(summary)} disabled={!summary}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkEnrolDialog({
  rows,
  onOpenChange,
  onSubmit,
}: {
  rows: DripRow[] | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (segmentId: string) => Promise<void>;
}) {
  const [segmentId, setSegmentId] = React.useState("");
  const open = !!rows;
  React.useEffect(() => {
    if (!open) setSegmentId("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Bulk enrol {rows?.length} drip{rows?.length === 1 ? "" : "s"} from a segment
          </DialogTitle>
          <DialogDescription>
            Every contact in the segment will be enrolled. Existing enrolments
            are not duplicated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Segment ID</Label>
          <Input
            placeholder="segment_…"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(segmentId)} disabled={!segmentId}>
            Enrol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
