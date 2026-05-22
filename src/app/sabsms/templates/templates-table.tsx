"use client";

/**
 * SabSMS templates list — client table.
 *
 * Owns interactivity for Page 9: filter chips, bulk selection, row
 * actions (duplicate / submit / withdraw / deprecate / convert-to-drip /
 * audit), inline tag editor, JSON import via SabFilePicker, JSON export,
 * and the side-drawer audit history.
 *
 * Server reads pass `initialRows` in; mutations flow through the
 * `"use server"` actions in `./actions.ts`. After a write succeeds we
 * `router.refresh()` so the server component re-renders with the new
 * doc set — no client cache to keep in sync.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveX,
  BarChart3,
  CopyPlus,
  FileJson,
  History,
  Send,
  ShieldCheck,
  Tags,
  Upload,
  Workflow,
  XCircle,
} from "lucide-react";

import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
  type SabsmsBulkAction,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";
import { SabFilePickerButton, fetchSabFilePickAsFile } from "@/components/sabfiles";
import {
  Badge,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  useZoruToast,
} from "@/components/zoruui";

import {
  duplicateTemplate,
  exportTemplateBundle,
  importTemplates,
  loadTemplateAudit,
  setDeprecated,
  setTemplateTags,
  submitTemplatesForApproval,
  withdrawSubmission,
  type TemplateAuditEvent,
} from "./actions";
import type { TemplateRow } from "./projection";

interface TemplatesTableProps {
  workspaceId: string;
  initialRows: TemplateRow[];
}

const STATUS_VARIANT: Record<
  TemplateRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  submitted: "outline",
  approved: "default",
  rejected: "destructive",
};

const CATEGORY_OPTIONS = [
  { value: "transactional", label: "Transactional" },
  { value: "otp", label: "OTP" },
  { value: "marketing", label: "Marketing" },
  { value: "alert", label: "Alert" },
  { value: "service", label: "Service" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const LOCALE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "de", label: "Deutsch" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name (A-Z)" },
  { value: "usage", label: "Usage count" },
];

export function TemplatesTable({ workspaceId: _workspaceId, initialRows }: TemplatesTableProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [auditId, setAuditId] = React.useState<string | null>(null);
  const [auditEvents, setAuditEvents] = React.useState<TemplateAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [tagsEditorId, setTagsEditorId] = React.useState<string | null>(null);
  const [tagsDraft, setTagsDraft] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [importJson, setImportJson] = React.useState("");
  const [importBusy, setImportBusy] = React.useState(false);
  const [convertId, setConvertId] = React.useState<string | null>(null);

  const selectedRow = React.useMemo(
    () => initialRows.find((r) => r.id === auditId),
    [initialRows, auditId],
  );
  const tagsEditorRow = React.useMemo(
    () => initialRows.find((r) => r.id === tagsEditorId),
    [initialRows, tagsEditorId],
  );

  function notifyResult(
    res: { ok: true } | { ok: false; error: string },
    okMessage: string,
  ) {
    if (res.ok) {
      toast({ title: okMessage });
      router.refresh();
    } else {
      toast({
        title: "Action failed",
        description: res.error,
        variant: "destructive",
      });
    }
  }

  async function handleDuplicate(row: TemplateRow) {
    const res = await duplicateTemplate(row.id);
    notifyResult(res, `Duplicated "${row.name}"`);
  }

  async function handleSubmit(row: TemplateRow) {
    const res = await submitTemplatesForApproval([row.id]);
    notifyResult(res, `Submitted "${row.name}" for approval`);
  }

  async function handleWithdraw(row: TemplateRow) {
    const res = await withdrawSubmission(row.id);
    notifyResult(res, `Withdrew "${row.name}"`);
  }

  async function handleDeprecate(row: TemplateRow) {
    const res = await setDeprecated({
      id: row.id,
      deprecated: !row.deprecated,
    });
    notifyResult(
      res,
      row.deprecated ? `Restored "${row.name}"` : `Deprecated "${row.name}"`,
    );
  }

  async function openAudit(row: TemplateRow) {
    setAuditId(row.id);
    setAuditEvents([]);
    setAuditLoading(true);
    try {
      const events = await loadTemplateAudit(row.id);
      setAuditEvents(events);
    } finally {
      setAuditLoading(false);
    }
  }

  function openTagsEditor(row: TemplateRow) {
    setTagsEditorId(row.id);
    setTagsDraft(row.tags.join(", "));
  }

  async function saveTags() {
    if (!tagsEditorId) return;
    const tags = tagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await setTemplateTags({ id: tagsEditorId, tags });
    setTagsEditorId(null);
    notifyResult(res, "Tags updated");
  }

  async function bulkSubmit(rows: TemplateRow[]) {
    const submittable = rows.filter((r) =>
      r.status === "draft" || r.status === "rejected",
    );
    if (submittable.length === 0) {
      toast({
        title: "Nothing to submit",
        description: "Pick draft or rejected templates to submit.",
      });
      return;
    }
    const res = await submitTemplatesForApproval(submittable.map((r) => r.id));
    setSelectedIds([]);
    notifyResult(res, `Submitted ${submittable.length} templates`);
  }

  async function bulkExport(rows: TemplateRow[]) {
    const res = await exportTemplateBundle(rows.map((r) => r.id));
    if (!res.ok) {
      toast({
        title: "Export failed",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    triggerDownload(`sabsms-templates-${Date.now()}.json`, res.json, "application/json");
    toast({ title: `Exported ${rows.length} templates` });
  }

  async function handleImportFromText() {
    if (!importJson.trim()) return;
    setImportBusy(true);
    try {
      const res = await importTemplates({ json: importJson });
      if (!res.ok) {
        toast({
          title: "Import failed",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: `Imported ${res.summary.inserted} templates`,
        description:
          res.summary.errors.length > 0
            ? `${res.summary.skipped} skipped — ${res.summary.errors[0]}`
            : undefined,
      });
      setImportOpen(false);
      setImportJson("");
      router.refresh();
    } finally {
      setImportBusy(false);
    }
  }

  // Filter columns. Note: column-picker hides/shows via `hideByDefault`.
  const columns: SabsmsColumn<TemplateRow>[] = [
    {
      id: "name",
      header: "Template",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/sabsms/templates/${row.id}`}
              className="font-medium text-slate-900 hover:text-amber-700"
            >
              {row.name}
            </Link>
            {row.deprecated && (
              <Badge variant="outline" className="text-rose-700">
                Deprecated
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {row.tags.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
            {row.tags.length > 4 && (
              <span className="text-[10px] text-slate-500">+{row.tags.length - 4}</span>
            )}
          </div>
        </div>
      ),
      width: "280px",
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
      ),
      width: "120px",
    },
    {
      id: "category",
      header: "Category",
      render: (row) => (
        <span className="text-xs uppercase text-slate-600">{row.category}</span>
      ),
      width: "120px",
    },
    {
      id: "preview",
      header: "Preview",
      render: (row) => (
        <ZoruTooltipProvider>
          <Tooltip>
            <ZoruTooltipTrigger asChild>
              <span className="line-clamp-1 max-w-[320px] cursor-help text-xs text-slate-600">
                {row.bodyPreview || <em className="text-slate-400">empty</em>}
              </span>
            </ZoruTooltipTrigger>
            <ZoruTooltipContent className="max-w-sm whitespace-pre-wrap text-left">
              {row.bodyPreview || "(empty)"}
            </ZoruTooltipContent>
          </Tooltip>
        </ZoruTooltipProvider>
      ),
    },
    {
      id: "registration",
      header: "Registration",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.dltRegistered && (
            <Badge variant="outline" className="text-emerald-700">
              <ShieldCheck className="mr-1 h-3 w-3" /> DLT
            </Badge>
          )}
          {row.tendlcRegistered && (
            <Badge variant="outline" className="text-blue-700">
              <ShieldCheck className="mr-1 h-3 w-3" /> 10DLC
            </Badge>
          )}
          {!row.dltRegistered && !row.tendlcRegistered && (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      ),
      width: "140px",
    },
    {
      id: "variables",
      header: "Vars",
      align: "right",
      render: (row) => (
        <ZoruTooltipProvider>
          <Tooltip>
            <ZoruTooltipTrigger asChild>
              <span className="cursor-help font-mono text-xs">
                {row.variables.length}
              </span>
            </ZoruTooltipTrigger>
            <ZoruTooltipContent>
              {row.variables.length === 0
                ? "No variables declared"
                : row.variables.map((v) => `{{${v}}}`).join(", ")}
            </ZoruTooltipContent>
          </Tooltip>
        </ZoruTooltipProvider>
      ),
      width: "70px",
    },
    {
      id: "locales",
      header: "Locales",
      hideByDefault: true,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.locales.map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px]">
              {l}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "usage",
      header: "Usage",
      align: "right",
      render: (row) => (
        <Link
          href={`/sabsms/analytics?templateId=${row.id}`}
          className="inline-flex items-center gap-1 font-mono text-xs text-slate-700 hover:text-amber-700"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {row.usageCount.toLocaleString()}
        </Link>
      ),
      width: "100px",
    },
    {
      id: "updatedAt",
      header: "Updated",
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
        </span>
      ),
      width: "120px",
    },
  ];

  const rowActions: SabsmsRowAction<TemplateRow>[] = [
    {
      label: "Duplicate",
      icon: <CopyPlus className="h-4 w-4" />,
      onSelect: handleDuplicate,
    },
    {
      label: "Submit for approval",
      icon: <Send className="h-4 w-4" />,
      onSelect: handleSubmit,
    },
    {
      label: "Withdraw submission",
      icon: <XCircle className="h-4 w-4" />,
      onSelect: handleWithdraw,
    },
    {
      label: "Toggle deprecated",
      icon: <ArchiveX className="h-4 w-4" />,
      onSelect: handleDeprecate,
    },
    {
      label: "Edit tags",
      icon: <Tags className="h-4 w-4" />,
      onSelect: openTagsEditor,
    },
    {
      label: "Convert to drip",
      icon: <Workflow className="h-4 w-4" />,
      onSelect: (row) => setConvertId(row.id),
    },
    {
      label: "Audit history",
      icon: <History className="h-4 w-4" />,
      onSelect: openAudit,
    },
  ];

  const bulkActions: SabsmsBulkAction<TemplateRow>[] = [
    {
      label: "Submit for approval",
      icon: <Send className="h-4 w-4" />,
      onSelect: bulkSubmit,
    },
    {
      label: "Export bundle",
      icon: <FileJson className="h-4 w-4" />,
      onSelect: bulkExport,
    },
  ];

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search templates by body or name…"
        facets={[
          { key: "status", label: "Status", options: STATUS_OPTIONS, multi: true },
          { key: "category", label: "Category", options: CATEGORY_OPTIONS, multi: true },
          { key: "locale", label: "Language", options: LOCALE_OPTIONS, multi: true },
        ]}
        sortOptions={SORT_OPTIONS}
        defaultSort="newest"
        trailing={
          <>
            <SabsmsSavedViews scope="templates.list" />
            <SabFilePickerButton
              accept="document"
              variant="outline"
              onPick={async (pick) => {
                try {
                  const file = await fetchSabFilePickAsFile(pick);
                  const text = await file.text();
                  setImportJson(text);
                  setImportOpen(true);
                } catch (e) {
                  toast({
                    title: "Could not read file",
                    description: (e as Error)?.message ?? "unknown error",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import JSON
            </SabFilePickerButton>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              Paste JSON
            </Button>
            <SabsmsExportMenu
              filename="sabsms-templates"
              toCsv={async () =>
                rowsToCsv(
                  initialRows.map((r) => ({
                    name: r.name,
                    status: r.status,
                    category: r.category,
                    locales: r.locales.join("|"),
                    variables: r.variables.length,
                    usage: r.usageCount,
                    dlt: r.dltRegistered ? "yes" : "no",
                    tendlc: r.tendlcRegistered ? "yes" : "no",
                  })),
                  [
                    { key: "name", header: "Name" },
                    { key: "status", header: "Status" },
                    { key: "category", header: "Category" },
                    { key: "locales", header: "Locales" },
                    { key: "variables", header: "Vars" },
                    { key: "usage", header: "Usage" },
                    { key: "dlt", header: "DLT" },
                    { key: "tendlc", header: "10DLC" },
                  ],
                )
              }
              toJson={async () => {
                const res = await exportTemplateBundle();
                return res.ok ? res.json : "{}";
              }}
            />
            <SabsmsRefreshButton onRefresh={() => router.refresh()} />
          </>
        }
      />

      <SabsmsDataTable<TemplateRow>
        rows={initialRows}
        columns={columns}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        emptyTitle="No templates yet"
        emptyDescription="Create your first SMS template or import a JSON bundle to get started."
        emptyAction={{
          label: "New template",
          href: "/sabsms/templates/new",
        }}
      />

      {/* Audit history drawer (feature 20) */}
      <SabsmsDetailDrawer
        open={auditId !== null}
        onOpenChange={(open) => !open && setAuditId(null)}
        title={selectedRow ? `Audit · ${selectedRow.name}` : "Audit"}
        description="Synthesised from the template lifecycle until a full audit log lands."
      >
        {auditLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : auditEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No events recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {auditEvents.map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className="flex items-start gap-3 rounded-md border border-slate-200 p-3"
              >
                <Badge variant="outline">{e.kind}</Badge>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{e.detail}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(e.at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SabsmsDetailDrawer>

      {/* Inline tag editor */}
      <Dialog
        open={tagsEditorId !== null}
        onOpenChange={(open) => !open && setTagsEditorId(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              Edit tags{tagsEditorRow ? ` · ${tagsEditorRow.name}` : ""}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Comma-separated. Up to 16 tags, each under 64 chars.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tags-input">Tags</Label>
            <Input
              id="tags-input"
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              placeholder="onboarding, otp, india"
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setTagsEditorId(null)}>
              Cancel
            </Button>
            <Button onClick={saveTags}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Import templates</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste a SabSMS bundle, or a single WhatsApp template JSON.
              Imports are created as drafts.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder={`{\n  "templates": [\n    { "name": "Welcome", "category": "transactional", "bodies": [{ "locale": "en", "body": "Hi {{name}}!" }] }\n  ]\n}`}
            className="min-h-[220px] font-mono text-xs"
          />
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportFromText}
              disabled={!importJson.trim() || importBusy}
            >
              {importBusy ? "Importing…" : "Import"}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Convert-to-drip suggestion */}
      <Dialog
        open={convertId !== null}
        onOpenChange={(open) => !open && setConvertId(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Convert template to drip</ZoruDialogTitle>
            <ZoruDialogDescription>
              Start a drip campaign using this template as its first step.
              You can add follow-up steps, conditions, and delays in the
              drip builder.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <p className="text-sm text-slate-600">
            We will pre-fill the drip builder with the template content; you can
            edit before saving.
          </p>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setConvertId(null)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href={`/sabsms/drips/new?fromTemplate=${convertId ?? ""}`}>
                Open drip builder
              </Link>
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

// ─── Local helpers ───────────────────────────────────────────────────────

function triggerDownload(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
