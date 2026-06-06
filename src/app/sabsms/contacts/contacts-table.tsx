"use client";

/**
 * SabSMS contacts — client interactive surface.
 *
 * Renders the data table, bulk actions, row actions, audit drawer,
 * import dialog, opt-in dialog, and inline tag/phone editors. All
 * mutations dispatch to the server actions in `./actions.ts`. The
 * server passes the workspace id + initial rows + URL filters; this
 * component never reads its own filters from the URL — filter state
 * lives in the URL via `SabsmsFilterBar`, and parent navigation
 * triggers a fresh fetch on every change.
 */

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash,
  Mail,
  MessageSquare,
  PhoneCall,
  Pencil,
  ShieldOff,
  Tag,
  Trash2,
  Users,
} from "lucide-react";

import { SabFilePicker } from "@/components/sabfiles";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/sabcrm/20ui';
import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
  type SabsmsColumn,
} from "@/components/sabsms/page-toolkit";

import {
  bulkAddToSegment,
  bulkAddToSuppression,
  bulkDeleteContacts,
  carrierLookup,
  importContactsCsv,
  loadContactAudit,
  mergeContacts,
  sendOptInConfirmation,
  setContactTags,
  updatePhoneFormat,
  type ContactAuditEntry,
  type ContactRow,
} from "./actions";

interface ContactsTableProps {
  initialRows: ContactRow[];
  total: number;
  page: number;
  pageSize: number;
  workspaceName?: string;
  countryOptions: { value: string; label: string }[];
}

const SOURCE_FACET = {
  key: "source",
  label: "Source",
  multi: true,
  options: [
    { value: "crm", label: "CRM" },
    { value: "import", label: "Import" },
    { value: "api", label: "API" },
    { value: "inbound", label: "Inbound" },
    { value: "derived", label: "Derived" },
  ],
} as const;

const CONSENT_FACET = {
  key: "consent",
  label: "Consent",
  multi: true,
  options: [
    { value: "double", label: "Double opt-in" },
    { value: "single", label: "Single opt-in" },
    { value: "none", label: "None" },
    { value: "opt_out", label: "Opted out" },
  ],
} as const;

function formatConsent(c: ContactRow["consent"]) {
  switch (c) {
    case "double":
      return <Badge variant="default">Double</Badge>;
    case "single":
      return <Badge variant="secondary">Single</Badge>;
    case "opt_out":
      return <Badge variant="destructive">Opted out</Badge>;
    default:
      return <Badge variant="outline">None</Badge>;
  }
}

function formatHour(h?: number): string {
  if (h === undefined) return "—";
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ap}`;
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ContactsTable({
  initialRows,
  total,
  page,
  pageSize,
  workspaceName,
  countryOptions,
}: ContactsTableProps) {
  const [rows, setRows] = React.useState(initialRows);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    kind: "ok" | "err";
    msg: string;
  } | null>(null);

  // Sync when server-rendered rows change (filter / page navigation).
  React.useEffect(() => {
    setRows(initialRows);
    setSelectedIds([]);
  }, [initialRows]);

  // Editor state.
  const [tagEditor, setTagEditor] = React.useState<{
    open: boolean;
    contact?: ContactRow;
    draft: string;
  }>({ open: false, draft: "" });
  const [phoneEditor, setPhoneEditor] = React.useState<{
    open: boolean;
    contact?: ContactRow;
    draft: string;
  }>({ open: false, draft: "" });
  const [auditDrawer, setAuditDrawer] = React.useState<{
    open: boolean;
    contact?: ContactRow;
    entries: ContactAuditEntry[];
    loading: boolean;
  }>({ open: false, entries: [], loading: false });
  const [importOpen, setImportOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    open: boolean;
    ids: string[];
  }>({ open: false, ids: [] });

  function feedbackResult(
    res: { ok: boolean; error?: string },
    okMsg: string,
  ) {
    if (res.ok) {
      setFeedback({ kind: "ok", msg: okMsg });
    } else {
      setFeedback({ kind: "err", msg: res.error ?? "Action failed" });
    }
    setTimeout(() => setFeedback(null), 4000);
  }

  async function withBusy<T>(label: string, fn: () => Promise<T>): Promise<T> {
    setBusy(label);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  // Row actions.
  async function handleCarrierLookup(row: ContactRow) {
    await withBusy("carrier", async () => {
      const res = await carrierLookup({ phone: row.phone });
      if (res.ok) {
        feedbackResult(
          { ok: true },
          `${row.phone}: ${res.carrier} (${res.lineType})`,
        );
      } else {
        feedbackResult({ ok: false, error: res.error }, "");
      }
    });
  }

  async function handleOptInRequest(row: ContactRow) {
    await withBusy("optin", async () => {
      const res = await sendOptInConfirmation({
        phone: row.phone,
        workspaceName,
      });
      feedbackResult(
        res.ok
          ? { ok: true }
          : { ok: false, error: res.error },
        "Opt-in confirmation sent",
      );
    });
  }

  function openTagEditor(row: ContactRow) {
    setTagEditor({ open: true, contact: row, draft: row.tags.join(", ") });
  }
  async function commitTagEditor() {
    if (!tagEditor.contact) return;
    const tags = tagEditor.draft.split(",").map((t) => t.trim());
    const res = await setContactTags({
      contactId: tagEditor.contact.id,
      tags,
    });
    feedbackResult(res, "Tags saved");
    if (res.ok && tagEditor.contact) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === tagEditor.contact!.id ? { ...r, tags } : r,
        ),
      );
    }
    setTagEditor({ open: false, draft: "" });
  }

  function openPhoneEditor(row: ContactRow) {
    setPhoneEditor({ open: true, contact: row, draft: row.phone });
  }
  async function commitPhoneEditor() {
    if (!phoneEditor.contact) return;
    const res = await updatePhoneFormat({
      contactId: phoneEditor.contact.id,
      phone: phoneEditor.draft,
    });
    feedbackResult(res, "Phone updated");
    if (res.ok) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === phoneEditor.contact!.id
            ? { ...r, phone: phoneEditor.draft }
            : r,
        ),
      );
    }
    setPhoneEditor({ open: false, draft: "" });
  }

  async function openAuditDrawer(row: ContactRow) {
    setAuditDrawer({ open: true, contact: row, entries: [], loading: true });
    const entries = await loadContactAudit({ phone: row.phone });
    setAuditDrawer((prev) => ({ ...prev, entries, loading: false }));
  }

  // Bulk handlers.
  async function bulkMerge(targets: ContactRow[]) {
    if (targets.length !== 2) {
      feedbackResult(
        { ok: false, error: "Select exactly 2 rows to merge" },
        "",
      );
      return;
    }
    const [into, from] = targets;
    const res = await mergeContacts({ intoId: into.id, fromId: from.id });
    feedbackResult(res, `Merged ${from.phone} into ${into.phone}`);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== from.id));
      setSelectedIds([]);
    }
  }

  async function bulkSegment(targets: ContactRow[]) {
    const res = await bulkAddToSegment({
      contactIds: targets.map((t) => t.id),
      segmentId: "phase18-placeholder",
    });
    feedbackResult(res, "Added to segment");
  }

  async function bulkSuppress(targets: ContactRow[]) {
    const res = await bulkAddToSuppression({
      phones: targets.map((t) => t.phone),
      reason: "Bulk action from /sabsms/contacts",
    });
    if (res.ok) {
      feedbackResult(
        { ok: true },
        `Suppressed ${res.added} new phone${res.added === 1 ? "" : "s"}`,
      );
      setSelectedIds([]);
    } else {
      feedbackResult({ ok: false, error: res.error }, "");
    }
  }

  function bulkDelete(targets: ContactRow[]) {
    setDeleteConfirm({ open: true, ids: targets.map((t) => t.id) });
  }
  async function confirmBulkDelete() {
    const res = await bulkDeleteContacts({
      contactIds: deleteConfirm.ids,
      retainSuppression: true,
    });
    if (res.ok) {
      feedbackResult(
        { ok: true },
        `Deleted ${res.deleted} contact${res.deleted === 1 ? "" : "s"}`,
      );
      setRows((prev) => prev.filter((r) => !deleteConfirm.ids.includes(r.id)));
      setSelectedIds([]);
    } else {
      feedbackResult({ ok: false, error: res.error }, "");
    }
    setDeleteConfirm({ open: false, ids: [] });
  }

  // CSV import via SabFiles picker.
  async function handleCsvPicked(file: { url: string; name: string }) {
    setImportOpen(false);
    await withBusy("import", async () => {
      try {
        const csv = await fetch(file.url).then((r) => r.text());
        const res = await importContactsCsv({ csv, defaultSource: "import" });
        if (res.ok) {
          feedbackResult(
            { ok: true },
            `Imported ${res.inserted} (skipped ${res.skipped})${
              res.errors.length > 0 ? ` · ${res.errors.length} errors` : ""
            }`,
          );
        } else {
          feedbackResult({ ok: false, error: res.error }, "");
        }
      } catch (err) {
        feedbackResult(
          { ok: false, error: (err as Error)?.message ?? "Import failed" },
          "",
        );
      }
    });
  }

  // Columns.
  const columns: SabsmsColumn<ContactRow>[] = [
    {
      id: "phone",
      header: "Phone",
      width: "180px",
      render: (r) => (
        <div className="flex flex-col">
          <Link
            href={`/sabsms/contacts/${encodeURIComponent(r.id)}`}
            className="font-mono text-sm text-[var(--st-text)] hover:underline"
          >
            {r.phone}
          </Link>
          {r.name && (
            <span className="text-xs text-[var(--st-text)]">{r.name}</span>
          )}
        </div>
      ),
    },
    {
      id: "country",
      header: "Country",
      width: "80px",
      render: (r) => <span className="text-xs uppercase">{r.country}</span>,
    },
    {
      id: "source",
      header: "Source",
      width: "90px",
      render: (r) => (
        <Badge variant="outline" className="text-[10px] uppercase">
          {r.source}
        </Badge>
      ),
    },
    {
      id: "consent",
      header: "Consent",
      width: "120px",
      render: (r) => formatConsent(r.consent),
    },
    {
      id: "engagement",
      header: "Score",
      width: "70px",
      align: "right",
      render: (r) => (
        <span
          className={
            r.engagementScore >= 60
              ? "font-semibold text-[var(--st-text)]"
              : r.engagementScore >= 20
                ? "text-[var(--st-text)]"
                : "text-[var(--st-text-secondary)]"
          }
        >
          {r.engagementScore}
        </span>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
          {r.tags.length > 3 && (
            <span className="text-xs text-[var(--st-text-secondary)]">
              +{r.tags.length - 3}
            </span>
          )}
          <button
            type="button"
            className="text-[10px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            onClick={() => openTagEditor(r)}
            aria-label="Edit tags"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ),
    },
    {
      id: "bestHour",
      header: "Best hr",
      width: "80px",
      render: (r) => (
        <span className="text-xs text-[var(--st-text)]">
          {formatHour(r.bestSendHour)}
        </span>
      ),
    },
    {
      id: "flags",
      header: "Flags",
      width: "90px",
      render: (r) => (
        <div className="flex gap-1">
          {r.isVoip && (
            <Badge variant="outline" className="text-[10px]">
              VoIP
            </Badge>
          )}
          {r.isDisposable && (
            <Badge variant="destructive" className="text-[10px]">
              Disp.
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "lastMessage",
      header: "Last activity",
      width: "120px",
      render: (r) => (
        <span className="text-xs text-[var(--st-text)]">
          {formatRelative(r.lastMessageAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search phone, name, email, tags…"
        facets={[
          { ...SOURCE_FACET, options: [...SOURCE_FACET.options] },
          {
            key: "country",
            label: "Country",
            multi: true,
            options: countryOptions,
          },
          { ...CONSENT_FACET, options: [...CONSENT_FACET.options] },
        ]}
        dateRangeKey={{ from: "from", to: "to" }}
        trailing={
          <div className="flex items-center gap-2">
            <SabsmsSavedViews scope="sabsms.contacts" />
            <SabsmsRefreshButton />
            <SabsmsExportMenu
              filename="sabsms-contacts"
              toCsv={async () =>
                rowsToCsv(
                  rows as unknown as Array<Record<string, unknown>>,
                  [
                    { key: "phone", header: "phone" },
                    { key: "country", header: "country" },
                    { key: "source", header: "source" },
                    { key: "consent", header: "consent" },
                    { key: "engagementScore", header: "engagement" },
                    { key: "totalSent", header: "sent" },
                    { key: "totalDelivered", header: "delivered" },
                    { key: "totalReplied", header: "replied" },
                    { key: "lastMessageAt", header: "lastMessageAt" },
                  ],
                )
              }
              toJson={async () =>
                rows.map((r) => JSON.stringify(r)).join("\n")
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              disabled={busy !== null}
            >
              Import CSV
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          className={
            feedback.kind === "ok"
              ? "rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]"
              : "rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]"
          }
          role="status"
        >
          {feedback.msg}
        </div>
      )}

      <SabsmsDataTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={[
          {
            label: "Merge selected (2 rows)",
            icon: <Users className="h-3.5 w-3.5" />,
            onSelect: bulkMerge,
          },
          {
            label: "Add to segment",
            icon: <Tag className="h-3.5 w-3.5" />,
            onSelect: bulkSegment,
          },
          {
            label: "Add to suppression",
            icon: <ShieldOff className="h-3.5 w-3.5" />,
            onSelect: bulkSuppress,
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            destructive: true,
            onSelect: bulkDelete,
          },
        ]}
        rowActions={[
          {
            label: "Open conversation",
            icon: <MessageSquare className="h-4 w-4" />,
            onSelect: (r) => {
              if (r.conversationId) {
                window.location.href = `/sabsms/inbox?conversationId=${r.conversationId}`;
              } else {
                feedbackResult(
                  { ok: false, error: "No conversation yet" },
                  "",
                );
              }
            },
          },
          {
            label: "Send SMS",
            icon: <Mail className="h-4 w-4" />,
            onSelect: (r) => {
              window.location.href = `/sabsms/send?to=${encodeURIComponent(r.phone)}`;
            },
          },
          {
            label: "Edit phone format",
            icon: <Pencil className="h-4 w-4" />,
            onSelect: openPhoneEditor,
          },
          {
            label: "Edit tags",
            icon: <Tag className="h-4 w-4" />,
            onSelect: openTagEditor,
          },
          {
            label: "Carrier (HLR) lookup",
            icon: <PhoneCall className="h-4 w-4" />,
            onSelect: handleCarrierLookup,
          },
          {
            label: "Send opt-in confirmation",
            icon: <CheckCircle2 className="h-4 w-4" />,
            onSelect: handleOptInRequest,
          },
          {
            label: "View audit",
            icon: <CircleSlash className="h-4 w-4" />,
            onSelect: openAuditDrawer,
          },
        ]}
        emptyTitle="No contacts yet"
        emptyDescription="Send a message or import a CSV to populate the contacts list."
      />

      {/* Tag editor */}
      <Dialog
        open={tagEditor.open}
        onOpenChange={(o) => setTagEditor((prev) => ({ ...prev, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>
              Comma-separated. Maximum 63 characters per tag.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={tagEditor.draft}
            onChange={(e) =>
              setTagEditor((prev) => ({ ...prev, draft: e.target.value }))
            }
            placeholder="vip, india-tier-1"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setTagEditor({ open: false, draft: "" })
              }
            >
              Cancel
            </Button>
            <Button onClick={commitTagEditor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone editor */}
      <Dialog
        open={phoneEditor.open}
        onOpenChange={(o) =>
          setPhoneEditor((prev) => ({ ...prev, open: o }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit phone format</DialogTitle>
            <DialogDescription>
              Phones must be E.164 (start with `+`, country code, then number).
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="phone-input">Phone</Label>
          <Input
            id="phone-input"
            value={phoneEditor.draft}
            onChange={(e) =>
              setPhoneEditor((prev) => ({ ...prev, draft: e.target.value }))
            }
            placeholder="+14155551212"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPhoneEditor({ open: false, draft: "" })}
            >
              Cancel
            </Button>
            <Button onClick={commitPhoneEditor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={auditDrawer.open}
        onOpenChange={(o) =>
          setAuditDrawer((prev) => ({ ...prev, open: o }))
        }
        title={`Audit — ${auditDrawer.contact?.phone ?? ""}`}
        description="Consent + opt-in/out events recorded for this contact."
      >
        {auditDrawer.loading ? (
          <div className="text-sm text-[var(--st-text)]">Loading…</div>
        ) : auditDrawer.entries.length === 0 ? (
          <div className="text-sm text-[var(--st-text)]">
            No audit entries yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {auditDrawer.entries.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-[var(--st-border)] bg-white p-3"
              >
                <div className="flex justify-between text-xs text-[var(--st-text)]">
                  <span>{e.actor ?? "system"}</span>
                  <span>{new Date(e.at).toLocaleString()}</span>
                </div>
                <div className="mt-1 font-medium">{e.kind}</div>
                {e.detail && (
                  <div className="mt-1 text-sm text-[var(--st-text)]">{e.detail}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SabsmsDetailDrawer>

      {/* CSV import — SabFiles picker only, no raw URL paste */}
      <SabFilePicker
        open={importOpen}
        onOpenChange={setImportOpen}
        accept="document"
        title="Pick a CSV from SabFiles"
        onPick={(p) => handleCsvPicked({ url: p.url, name: p.name })}
      />

      {/* Bulk delete confirmation */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(o) =>
          setDeleteConfirm((prev) => ({ ...prev, open: o }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteConfirm.ids.length} contact
              {deleteConfirm.ids.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The contact rows will be removed but a suppression record will
              be retained so future imports stay opt-out compliant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
