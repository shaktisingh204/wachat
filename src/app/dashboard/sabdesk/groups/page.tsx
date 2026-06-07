"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  ColorPicker,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  IconButton,
  IconPicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Textarea,
  cn,
  useToast,
  type BadgeTone,
} from "@/components/sabcrm/20ui";
import { EntityFormField } from "@/components/crm/entity-form-field";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Download, Edit, LoaderCircle, Plus, Trash2, X } from "lucide-react";

/**
 * Ticket Groups - settings-style list (mirrors the Account Groups page).
 *
 * Inline-create / edit dialog with parent-group selector (populated from
 * the same list), default-assignee + default-SLA pickers, color + icon,
 * description, and active toggle. Search + status filter on top.
 *
 * Reads/writes route through `crm-ticket-groups.actions.ts`, which is a
 * thin shim over the Rust BFF at `/v1/crm/ticket-groups`.
 */

import * as React from "react";

import { EntityListShell } from "@/components/crm/entity-list-shell";

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

const STATUS_TONE: Record<CrmTicketGroupStatus, BadgeTone> = {
  active: "success",
  archived: "neutral",
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} disabled={pending}>
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
  const { toast } = useToast();

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
      toast({ title: "Success", description: state.message, tone: "success" });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: "Error", description: state.error, tone: "danger" });
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
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          {isEditing ? (
            <input type="hidden" name="_id" value={String(initialData!._id)} />
          ) : null}
          {/* Switch doesn't post a value - mirror it into a hidden input */}
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

          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit" : "Create new"} ticket group
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <Field label="Name" required>
              <Input
                name="name"
                placeholder="e.g. Billing Issues"
                required
                defaultValue={initialData?.name}
              />
            </Field>

            <Field label="Description">
              <Textarea
                name="description"
                placeholder="What kinds of tickets land in this group?"
                rows={2}
                defaultValue={initialData?.description ?? ""}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parentGroupId">Parent group</Label>
              <Select
                value={parentGroupId || "__none__"}
                onValueChange={(v) =>
                  setParentGroupId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger id="parentGroupId">
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent</SelectItem>
                  {filteredParentOptions.map((g) => (
                    <SelectItem key={g._id} value={g._id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Default assignee</Label>
                <EntityFormField
                  entity="user"
                  name="__defaultAssigneeId_picker"
                  initialId={defaultAssigneeId || null}
                  onChange={(id) => setDefaultAssigneeId(id ?? "")}
                  placeholder="Pick a user"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Default SLA</Label>
                <EntityFormField
                  entity="sla"
                  name="__defaultSlaId_picker"
                  initialId={defaultSlaId || null}
                  onChange={(id) => setDefaultSlaId(id ?? "")}
                  placeholder="Pick an SLA"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Color</Label>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Icon</Label>
                <IconPicker value={icon} onChange={setIcon} color={color} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2">
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
                aria-label="Active"
              />
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statusSelect">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as CrmTicketGroupStatus)}
                >
                  <SelectTrigger id="statusSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isEditing={isEditing} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColorSwatch({ color }: { color?: string }) {
  if (!color) {
    return <span className="text-xs text-[var(--st-text-secondary)]">-</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-4 w-4 rounded-full border border-[var(--st-border)]"
        // Runtime, user-picked color value.
        style={{ backgroundColor: color }}
        aria-hidden="true"
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
  const { toast } = useToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getTicketGroups({ status: "all", limit: 200 });
    if (res.error) {
      toast({
        title: "Failed to load",
        description: res.error,
        tone: "danger",
      });
    }
    setGroups(res.groups);
    setIsLoading(false);
  }, [toast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Map id -> group for quick parent-name lookups in the table.
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
        toast({ title: "Group deleted", tone: "success" });
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
          tone: "danger",
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
        tone: failed > 0 ? "danger" : "neutral",
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
      toast({ title: "Nothing to export", tone: "neutral" });
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

  const allSelected =
    filtered.length > 0 &&
    filtered.every((g) => selected.has(String(g._id)));
  const someSelected = filtered.some((g) => selected.has(String(g._id)));

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
            <Button variant="primary" iconLeft={Plus} onClick={() => handleOpenDialog(null)}>
              New Group
            </Button>
          }
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search groups",
          }}
          filters={
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[160px]" aria-label="Status filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
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
                  iconLeft={Trash2}
                  disabled={bulkDeleting}
                  onClick={handleBulkDelete}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Download}
                  onClick={handleExportCsv}
                >
                  Export CSV
                </Button>
                <span className="ml-auto" />
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={X}
                  onClick={() => setSelected(new Set())}
                >
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
              <StatCard
                label="Total groups"
                value={kpis.total.toLocaleString()}
                role="button"
                tabIndex={0}
                aria-pressed={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setStatusFilter("all");
                  }
                }}
                className={cn(
                  "cursor-pointer text-left",
                  statusFilter === "all" &&
                    "ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]",
                )}
              />
              <StatCard
                label="Active"
                value={kpis.active.toLocaleString()}
                role="button"
                tabIndex={0}
                aria-pressed={statusFilter === "active"}
                onClick={() => setStatusFilter("active")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setStatusFilter("active");
                  }
                }}
                className={cn(
                  "cursor-pointer text-left",
                  statusFilter === "active" &&
                    "ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]",
                )}
              />
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
                  iconLeft={Download}
                  onClick={handleExportCsv}
                  disabled={filtered.length === 0}
                >
                  Export CSV
                </Button>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-10">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? new Set(filtered.map((g) => String(g._id)))
                              : new Set(),
                          )
                        }
                        aria-label="Select all"
                      />
                    </Th>
                    <Th>Name</Th>
                    <Th>Parent Group</Th>
                    <Th>Default Assignee</Th>
                    <Th>Default SLA</Th>
                    <Th>Color</Th>
                    <Th align="right">Tickets</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {isLoading ? (
                    <Tr>
                      <Td colSpan={9} align="center" className="h-24">
                        <LoaderCircle
                          className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]"
                          aria-hidden="true"
                        />
                      </Td>
                    </Tr>
                  ) : filtered.length === 0 ? (
                    <Tr>
                      <Td
                        colSpan={9}
                        align="center"
                        className="h-24 text-[var(--st-text-secondary)]"
                      >
                        No ticket groups match this filter.
                      </Td>
                    </Tr>
                  ) : (
                    filtered.map((g) => {
                      const parent = g.parentGroupId
                        ? byId.get(g.parentGroupId)
                        : null;
                      const id = String(g._id);
                      return (
                        <Tr key={id} selected={selected.has(id)}>
                          <Td>
                            <Checkbox
                              checked={selected.has(id)}
                              onChange={() =>
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(id)) next.delete(id);
                                  else next.add(id);
                                  return next;
                                })
                              }
                              aria-label={`Select ${g.name}`}
                            />
                          </Td>
                          <Td className="font-medium text-[var(--st-text)]">
                            <div className="flex flex-col">
                              <span>{g.name}</span>
                              {g.description ? (
                                <span className="text-xs text-[var(--st-text-secondary)] line-clamp-1">
                                  {g.description}
                                </span>
                              ) : null}
                            </div>
                          </Td>
                          <Td className="text-[var(--st-text)]">
                            {parent ? (
                              parent.name
                            ) : g.parentGroupId ? (
                              <span
                                className="font-mono text-xs text-[var(--st-text-secondary)]"
                                title={g.parentGroupId}
                              >
                                {g.parentGroupId.slice(0, 8)}
                              </span>
                            ) : (
                              <span className="text-[var(--st-text-secondary)]">
                                -
                              </span>
                            )}
                          </Td>
                          <Td>
                            {g.defaultAssigneeId ? (
                              <span
                                className="font-mono text-xs text-[var(--st-text)]"
                                title={g.defaultAssigneeId}
                              >
                                {g.defaultAssigneeId.slice(0, 8)}
                              </span>
                            ) : (
                              <span className="text-[var(--st-text-secondary)]">
                                -
                              </span>
                            )}
                          </Td>
                          <Td>
                            {g.defaultSlaId ? (
                              <span
                                className="font-mono text-xs text-[var(--st-text)]"
                                title={g.defaultSlaId}
                              >
                                {g.defaultSlaId.slice(0, 8)}
                              </span>
                            ) : (
                              <span className="text-[var(--st-text-secondary)]">
                                -
                              </span>
                            )}
                          </Td>
                          <Td>
                            <ColorSwatch color={g.color} />
                          </Td>
                          <Td align="right" className="font-mono text-[var(--st-text)]">
                            {g.ticketsCount ?? 0}
                          </Td>
                          <Td>
                            <Badge tone={STATUS_TONE[g.status] ?? "neutral"}>
                              {g.status}
                            </Badge>
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-1">
                              <IconButton
                                label="Edit group"
                                icon={Edit}
                                onClick={() => handleOpenDialog(g)}
                              />
                              <IconButton
                                label="Delete group"
                                icon={Trash2}
                                onClick={() => setPendingDelete(g)}
                              />
                            </div>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        </EntityListShell>
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ticket group?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting &quot;{pendingDelete?.name}&quot; will affect{" "}
              {pendingDelete?.ticketsCount ?? 0} ticket(s) currently in this
              group. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
