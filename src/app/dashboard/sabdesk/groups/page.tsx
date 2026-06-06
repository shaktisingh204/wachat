"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Checkbox,
  ZoruColorPicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruIconPicker,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
  useZoruToast,
} from "@/components/zoruui";
import { EntityFormField } from "@/components/crm/entity-form-field";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Download,
  Edit,
  LifeBuoy,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";

/**
 * Ticket Groups — settings-style list (mirrors the Account Groups page).
 *
 * Inline-create / edit dialog with parent-group selector (populated from
 * the same list), default-assignee + default-SLA ObjectId text inputs
 * (no embedded picker — see "Gaps" in the implementation report), color
 * + icon, description, and active toggle. Search + status filter on top.
 *
 * Reads/writes route through `crm-ticket-groups.actions.ts`, which is a
 * thin shim over the Rust BFF at `/v1/crm/ticket-groups`.
 */

import * as React from "react";

import { EntityListShell } from "@/components/crm/entity-list-shell";
import { StatusPill, type StatusTone } from "@/components/crm/status-pill";

import {
  deleteTicketGroup,
  getTicketGroups,
  saveTicketGroup,
  type SaveTicketGroupState,
} from "@/app/actions/crm-ticket-groups.actions";
import type {
  CrmTicketGroupDoc,
  CrmTicketGroupStatus,
} from "@/lib/rust-client/crm-ticket-groups";

type StatusFilter = "all" | CrmTicketGroupStatus;

const saveInitialState: SaveTicketGroupState = {};

const STATUS_TONE: Record<CrmTicketGroupStatus, StatusTone> = {
  active: "green",
  archived: "neutral",
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isEditing ? "Save changes" : "Create group"}
    </Button>
  );
}

function TicketGroupDialog({
  isOpen,
  onOpenChange,
  onSave,
  initialData,
  parentOptions,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  initialData: CrmTicketGroupDoc | null;
  parentOptions: CrmTicketGroupDoc[];
}) {
  const isEditing = !!initialData;
  const [state, formAction] = useActionState(saveTicketGroup, saveInitialState);
  const { toast } = useZoruToast();

  const [isActive, setIsActive] = React.useState<boolean>(
    initialData?.isActive ?? true,
  );
  const [parentGroupId, setParentGroupId] = React.useState<string>(
    initialData?.parentGroupId ?? "",
  );
  const [status, setStatus] = React.useState<CrmTicketGroupStatus>(
    initialData?.status ?? "active",
  );
  const [defaultAssigneeId, setDefaultAssigneeId] = React.useState<string>(
    initialData?.defaultAssigneeId ?? "",
  );
  const [defaultSlaId, setDefaultSlaId] = React.useState<string>(
    initialData?.defaultSlaId ?? "",
  );
  const [color, setColor] = React.useState<string>(
    initialData?.color ?? "#0EA5E9",
  );
  const [icon, setIcon] = React.useState<string>(initialData?.icon ?? "");

  React.useEffect(() => {
    if (!isOpen) return;
    setIsActive(initialData?.isActive ?? true);
    setParentGroupId(initialData?.parentGroupId ?? "");
    setStatus(initialData?.status ?? "active");
    setDefaultAssigneeId(initialData?.defaultAssigneeId ?? "");
    setDefaultSlaId(initialData?.defaultSlaId ?? "");
    setColor(initialData?.color ?? "#0EA5E9");
    setIcon(initialData?.icon ?? "");
  }, [initialData, isOpen]);

  React.useEffect(() => {
    if (state.message) {
      toast({ title: "Success", description: state.message });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
    // We only want to react to a fresh server-action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Don't let a group be its own parent.
  const filteredParentOptions = React.useMemo(
    () =>
      parentOptions.filter((g) => !initialData || g._id !== initialData._id),
    [parentOptions, initialData],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <form action={formAction}>
          {isEditing ? (
            <input type="hidden" name="_id" value={String(initialData!._id)} />
          ) : null}
          {/* Switch doesn't post a value — mirror it into a hidden input */}
          <input
            type="hidden"
            name="isActive"
            value={isActive ? "true" : "false"}
          />
          <input type="hidden" name="parentGroupId" value={parentGroupId} />
          <input
            type="hidden"
            name="defaultAssigneeId"
            value={defaultAssigneeId}
          />
          <input type="hidden" name="defaultSlaId" value={defaultSlaId} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="icon" value={icon} />
          {isEditing ? (
            <input type="hidden" name="status" value={status} />
          ) : null}

          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? "Edit" : "Create new"} ticket group
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Billing Issues"
                required
                defaultValue={initialData?.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What kinds of tickets land in this group?"
                rows={2}
                defaultValue={initialData?.description ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentGroupId">Parent group</Label>
              <Select
                value={parentGroupId || "__none__"}
                onValueChange={(v) =>
                  setParentGroupId(v === "__none__" ? "" : v)
                }
              >
                <ZoruSelectTrigger id="parentGroupId">
                  <ZoruSelectValue placeholder="No parent" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">
                    — No parent —
                  </ZoruSelectItem>
                  {filteredParentOptions.map((g) => (
                    <ZoruSelectItem key={g._id} value={g._id}>
                      {g.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Default assignee</Label>
                <EntityFormField
                  entity="user"
                  name="__defaultAssigneeId_picker"
                  initialId={defaultAssigneeId || null}
                  onChange={(id) => setDefaultAssigneeId(id ?? "")}
                  placeholder="Pick a user…"
                />
              </div>
              <div className="space-y-2">
                <Label>Default SLA</Label>
                <EntityFormField
                  entity="sla"
                  name="__defaultSlaId_picker"
                  initialId={defaultSlaId || null}
                  onChange={(id) => setDefaultSlaId(id ?? "")}
                  placeholder="Pick an SLA…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color</Label>
                <ZoruColorPicker value={color} onChange={setColor} />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <ZoruIconPicker value={icon} onChange={setIcon} color={color} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2">
              <div className="flex flex-col">
                <Label htmlFor="isActiveToggle">Active</Label>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  Inactive groups are hidden from ticket pickers.
                </span>
              </div>
              <Switch
                id="isActiveToggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="statusSelect">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as CrmTicketGroupStatus)}
                >
                  <ZoruSelectTrigger id="statusSelect">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

function ColorSwatch({ color }: { color?: string }) {
  if (!color) {
    return <span className="text-xs text-[var(--st-text-secondary)]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-4 w-4 rounded-full border border-[var(--st-border)]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-mono text-xs text-[var(--st-text)]">{color}</span>
    </span>
  );
}

function buildGroupsCsv(rows: CrmTicketGroupDoc[]): string {
  const header = ["Name", "Status", "Parent Group", "Tickets"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    header.join(","),
    ...rows.map((r) =>
      [
        escape(r.name),
        escape(r.status),
        escape(r.parentGroupId ?? ""),
        escape(r.ticketsCount ?? 0),
      ].join(","),
    ),
  ].join("\n");
}

export default function TicketGroupsPage() {
  const [groups, setGroups] = React.useState<CrmTicketGroupDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<CrmTicketGroupDoc | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmTicketGroupDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, startBulkDelete] = React.useTransition();
  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getTicketGroups({ status: "all", limit: 200 });
    if (res.error) {
      toast({
        title: "Failed to load",
        description: res.error,
        variant: "destructive",
      });
    }
    setGroups(res.groups);
    setIsLoading(false);
  }, [toast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Map id → group for quick parent-name lookups in the table.
  const byId = React.useMemo(() => {
    const map = new Map<string, CrmTicketGroupDoc>();
    for (const g of groups) map.set(String(g._id), g);
    return map;
  }, [groups]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${g.name} ${g.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [groups, search, statusFilter]);

  const handleOpenDialog = (group: CrmTicketGroupDoc | null) => {
    setEditing(group);
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = String(pendingDelete._id);
    startDeleteTransition(async () => {
      const result = await deleteTicketGroup(id);
      if (result.success) {
        toast({ title: "Group deleted" });
        setPendingDelete(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await refresh();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteTicketGroup(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      setSelected(new Set());
      toast({
        title: "Bulk delete",
        description: `${ok} removed${failed ? `, ${failed} failed` : ""}.`,
        variant: failed > 0 ? "destructive" : undefined,
      });
      await refresh();
    });
  };

  const handleExportCsv = () => {
    const src =
      selected.size > 0
        ? filtered.filter((g) => selected.has(String(g._id)))
        : filtered;
    if (!src.length) {
      toast({ title: "Nothing to export" });
      return;
    }
    const csv = buildGroupsCsv(src);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-groups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = React.useMemo(
    () => ({
      total: groups.length,
      active: groups.filter((g) => g.status === "active").length,
      avgTickets:
        groups.length > 0
          ? Math.round(
              groups.reduce((s, g) => s + (g.ticketsCount ?? 0), 0) /
                groups.length,
            )
          : 0,
    }),
    [groups],
  );

  return (
    <>
      <TicketGroupDialog
        // Re-mount on edit-target change so useActionState resets cleanly.
        key={editing ? String(editing._id) : "create"}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={refresh}
        initialData={editing}
        parentOptions={groups}
      />

      <div className="flex w-full flex-col gap-6">
        <EntityListShell
          title="Ticket Groups"
          subtitle="Organize support tickets by team, product, or domain."
          primaryAction={
            <Button onClick={() => handleOpenDialog(null)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Group
            </Button>
          }
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search groups…",
          }}
          filters={
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          }
          bulkBar={
            selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-medium text-[var(--st-text)]">
                  {selected.size} selected
                </span>
                <span className="text-[var(--st-text-secondary)]">·</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={bulkDeleting}
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={handleExportCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <span className="ml-auto" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            ) : null
          }
          loading={isLoading && groups.length === 0}
        >
          <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                className="text-left"
                onClick={() => setStatusFilter("all")}
              >
                <StatCard
                  label="Total groups"
                  value={kpis.total.toLocaleString()}
                  className={cn(
                    statusFilter === "all" &&
                      "ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]",
                  )}
                />
              </button>
              <button
                type="button"
                className="text-left"
                onClick={() => setStatusFilter("active")}
              >
                <StatCard
                  label="Active"
                  value={kpis.active.toLocaleString()}
                  className={cn(
                    statusFilter === "active" &&
                      "ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]",
                  )}
                />
              </button>
              <StatCard
                label="Avg tickets / group"
                value={kpis.avgTickets.toLocaleString()}
              />
            </div>

            {/* Export toolbar when nothing selected */}
            {selected.size === 0 ? (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={filtered.length === 0}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <Checkbox
                        checked={
                          filtered.length > 0 &&
                          filtered.every((g) => selected.has(String(g._id)))
                            ? true
                            : filtered.some((g) => selected.has(String(g._id)))
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(v) =>
                          setSelected(
                            v === true
                              ? new Set(filtered.map((g) => String(g._id)))
                              : new Set(),
                          )
                        }
                        aria-label="Select all"
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                      Name
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                      Parent Group
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                      Default Assignee
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                      Default SLA
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                      Color
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)] text-right">
                      Tickets
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                      Status
                    </ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)] text-right">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {isLoading ? (
                    <ZoruTableRow className="border-[var(--st-border)]">
                      <ZoruTableCell colSpan={9} className="h-24 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : filtered.length === 0 ? (
                    <ZoruTableRow className="border-[var(--st-border)]">
                      <ZoruTableCell
                        colSpan={9}
                        className="h-24 text-center text-[var(--st-text-secondary)]"
                      >
                        No ticket groups match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    filtered.map((g) => {
                      const parent = g.parentGroupId
                        ? byId.get(g.parentGroupId)
                        : null;
                      return (
                        <ZoruTableRow
                          key={String(g._id)}
                          className={cn(
                            "border-[var(--st-border)]",
                            selected.has(String(g._id)) && "bg-[var(--st-bg-secondary)]",
                          )}
                        >
                          <ZoruTableCell>
                            <Checkbox
                              checked={selected.has(String(g._id))}
                              onCheckedChange={() =>
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  const id = String(g._id);
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                  return next;
                                })
                              }
                              aria-label={`Select ${g.name}`}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-[var(--st-text)]">
                            <div className="flex flex-col">
                              <span>{g.name}</span>
                              {g.description ? (
                                <span className="text-xs text-[var(--st-text-secondary)] line-clamp-1">
                                  {g.description}
                                </span>
                              ) : null}
                            </div>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[var(--st-text)]">
                            {parent ? (
                              parent.name
                            ) : g.parentGroupId ? (
                              <span
                                className="font-mono text-xs text-[var(--st-text-secondary)]"
                                title={g.parentGroupId}
                              >
                                {g.parentGroupId.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className="text-[var(--st-text-secondary)]">—</span>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {g.defaultAssigneeId ? (
                              <span
                                className="font-mono text-xs text-[var(--st-text)]"
                                title={g.defaultAssigneeId}
                              >
                                {g.defaultAssigneeId.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className="text-[var(--st-text-secondary)]">—</span>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {g.defaultSlaId ? (
                              <span
                                className="font-mono text-xs text-[var(--st-text)]"
                                title={g.defaultSlaId}
                              >
                                {g.defaultSlaId.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className="text-[var(--st-text-secondary)]">—</span>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ColorSwatch color={g.color} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right font-mono text-[var(--st-text)]">
                            {g.ticketsCount ?? 0}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill
                              label={g.status}
                              tone={STATUS_TONE[g.status] ?? "neutral"}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(g)}
                              aria-label="Edit group"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDelete(g)}
                              aria-label="Delete group"
                            >
                              <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                            </Button>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </Table>
            </div>
          </div>
        </EntityListShell>
      </div>

      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete ticket group?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{pendingDelete?.name}&rdquo; will affect{" "}
              {pendingDelete?.ticketsCount ?? 0} ticket(s) currently in this
              group. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
