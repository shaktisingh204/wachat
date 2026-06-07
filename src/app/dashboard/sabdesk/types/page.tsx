"use client";

/**
 * Ticket Types - §1D.4 bar:
 *  - KPI strip (Total, With colour, Distinct colours)
 *  - Search across type name
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on type name
 */

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  Checkbox,
  ColorPicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Download,
  Palette,
  Pencil,
  Plus,
  SwatchBook,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { EntityListShell } from "@/components/crm/entity-list-shell";
import { RowDrawer } from "@/components/crm/row-drawer";
import {
  getTicketTypes,
  saveTicketType,
  deleteTicketType,
} from "@/app/actions/worksuite/tickets-ext.actions";
import type { WsTicketType } from "@/lib/worksuite/tickets-ext-types";

type Row = WsTicketType & { _id: string };

function buildCsv(rows: Row[]): string {
  const header = ["Type", "Colour"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    header.join(","),
    ...rows.map((r) => [escape(r.type), escape(r.color ?? "")].join(",")),
  ].join("\n");
}

export default function TicketTypesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [color, setColor] = useState("#6B7280");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saveState, saveFormAction, isSaving] = useActionState(saveTicketType, {
    message: "",
    error: "",
  } as { message: string; error: string });

  const refresh = useCallback(() => {
    startLoading(async () => {
      const data = await getTicketTypes();
      setRows(data as unknown as Row[]);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast.success({ title: "Saved", description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast.error({ title: "Error", description: saveState.error });
    }
  }, [saveState, refresh, toast]);

  const openAdd = () => {
    setEditing(null);
    setColor("#6B7280");
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setColor(row.color || "#6B7280");
    setDialogOpen(true);
  };

  /* Filter */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.type.toLowerCase().includes(q));
  }, [rows, search]);

  /* KPIs */

  const kpis = useMemo(
    () => ({
      total: rows.length,
      withColour: rows.filter((r) => (r.color || "").trim().length > 0).length,
      distinctColours: new Set(
        rows.map((r) => (r.color || "").toLowerCase()).filter(Boolean),
      ).size,
    }),
    [rows],
  );

  /* Selection */

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));
  const someSelected =
    !allSelected && filtered.some((r) => selected.has(r._id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (v: boolean) =>
    setSelected(v ? new Set(filtered.map((r) => r._id)) : new Set());

  /* Delete handlers */

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteTicketType(deletingId);
    if (res.success) {
      toast.success({ title: "Deleted", description: "Type removed." });
      setDeletingId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deletingId);
        return next;
      });
      refresh();
    } else {
      toast.error({
        title: "Error",
        description: res.error || "Failed to delete",
      });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkDeleting(true);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const res = await deleteTicketType(id);
        if (res.success) ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkDeleting(false);
    setSelected(new Set());
    toast({
      title: "Bulk delete",
      description: `${ok} removed${failed ? `, ${failed} failed` : ""}.`,
      tone: failed > 0 ? "danger" : "success",
    });
    refresh();
  };

  /* CSV export */

  const handleExportCsv = () => {
    const src =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    if (!src.length) {
      toast({ title: "Nothing to export", tone: "neutral" });
      return;
    }
    const csv = buildCsv(src);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-types-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <EntityListShell
      title="Ticket Types"
      subtitle="Ticket categorisation types with colour coding."
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search types...",
      }}
      primaryAction={
        <Button variant="primary" iconLeft={Plus} onClick={openAdd}>
          Add Type
        </Button>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-[var(--st-text)]">
              {selected.size} selected
            </span>
            <span className="text-[var(--st-text-secondary)]" aria-hidden="true">
              ·
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Trash2}
              disabled={bulkDeleting}
              loading={bulkDeleting}
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
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total types"
            value={kpis.total.toLocaleString()}
            icon={Tag}
          />
          <StatCard
            label="With colour"
            value={kpis.withColour.toLocaleString()}
            icon={Palette}
          />
          <StatCard
            label="Distinct colours"
            value={kpis.distinctColours.toLocaleString()}
            icon={SwatchBook}
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

        <Card className="p-6">
          <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  <Th width={40}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th>Type</Th>
                  <Th>Colour</Th>
                  <Th align="right" width={120}>
                    Actions
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading && rows.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <Tr key={i}>
                      <Td colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </Td>
                    </Tr>
                  ))
                ) : filtered.length === 0 ? (
                  <Tr>
                    <Td colSpan={4}>
                      <EmptyState
                        icon={Tag}
                        title={
                          rows.length === 0
                            ? "No types yet"
                            : "No matching types"
                        }
                        description={
                          rows.length === 0
                            ? "Click Add Type to create your first ticket type."
                            : "No types match this search."
                        }
                        size="sm"
                      />
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((row) => (
                    <Tr key={row._id} selected={selected.has(row._id)}>
                      <Td>
                        <Checkbox
                          checked={selected.has(row._id)}
                          onChange={() => toggleOne(row._id)}
                          aria-label={`Select ${row.type}`}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <RowDrawer
                          label={row.type}
                          subtitle={row.color ?? undefined}
                          title={`Type: ${row.type}`}
                          description="Use the row Edit action to change this type."
                        >
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Type name
                              </div>
                              <div>{row.type}</div>
                            </div>
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Colour
                              </div>
                              {row.color ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-4 w-4 rounded-[4px] border border-[var(--st-border)]"
                                    style={{ backgroundColor: row.color }}
                                    aria-hidden="true"
                                  />
                                  <code className="text-[12px]">
                                    {row.color}
                                  </code>
                                </div>
                              ) : (
                                <div className="text-[var(--st-text-secondary)]">
                                  Not set
                                </div>
                              )}
                            </div>
                          </div>
                        </RowDrawer>
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded-[4px] border border-[var(--st-border)]"
                            style={{ backgroundColor: row.color || "#6B7280" }}
                            aria-hidden="true"
                          />
                          <code className="text-[12px] text-[var(--st-text-secondary)]">
                            {row.color || "Not set"}
                          </code>
                        </div>
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            label={`Edit ${row.type}`}
                            icon={Pencil}
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(row)}
                          />
                          <IconButton
                            label={`Delete ${row.type}`}
                            icon={Trash2}
                            variant="danger"
                            size="sm"
                            onClick={() => setDeletingId(row._id)}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Type" : "Add Type"}</DialogTitle>
            <DialogDescription>
              Assign a colour hex code to visually distinguish the type.
            </DialogDescription>
          </DialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <Field label="Type" required>
              <Input
                name="type"
                required
                defaultValue={editing?.type || ""}
                placeholder="e.g. Billing"
              />
            </Field>
            <Field label="Colour">
              <input type="hidden" name="color" value={color} />
              <ColorPicker value={color} onChange={setColor} />
            </Field>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSaving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}
