"use client";

/**
 * Ticket Types — §1D.4 bar:
 *  - KPI strip (Total · With colour · Distinct colours)
 *  - Search across type name
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on type name
 */

import * as React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Card, Checkbox, ColorPicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Skeleton, StatCard, Table, TBody, Td, Th, THead, Tr, cn, useToast } from '@/components/sabcrm/20ui/compat';
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
  LoaderCircle,
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
      toast({ title: "Saved", description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: "Error",
        description: saveState.error,
        variant: "destructive",
      });
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

  /* ── Filter ───────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.type.toLowerCase().includes(q));
  }, [rows, search]);

  /* ── KPIs ─────────────────────────────────────────────────────── */

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

  /* ── Selection ────────────────────────────────────────────────── */

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

  /* ── Delete handlers ──────────────────────────────────────────── */

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteTicketType(deletingId);
    if (res.success) {
      toast({ title: "Deleted", description: "Type removed." });
      setDeletingId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deletingId);
        return next;
      });
      refresh();
    } else {
      toast({
        title: "Error",
        description: res.error || "Failed to delete",
        variant: "destructive",
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
      variant: failed > 0 ? "destructive" : undefined,
    });
    refresh();
  };

  /* ── CSV export ───────────────────────────────────────────────── */

  const handleExportCsv = () => {
    const src =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    if (!src.length) {
      toast({ title: "Nothing to export" });
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
        placeholder: "Search types…",
      }}
      primaryAction={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Type
        </Button>
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
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Total types"
            value={kpis.total.toLocaleString()}
            icon={<Tag className="h-4 w-4" />}
          />
          <StatCard
            label="With colour"
            value={kpis.withColour.toLocaleString()}
            icon={<Palette className="h-4 w-4" />}
          />
          <StatCard
            label="Distinct colours"
            value={kpis.distinctColours.toLocaleString()}
            icon={<SwatchBook className="h-4 w-4" />}
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

        <Card className="p-6">
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                  <Th className="w-10">
                    <Checkbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Type
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Colour
                  </Th>
                  <Th className="w-[120px] text-right text-[var(--st-text-secondary)]">
                    Actions
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading && rows.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <Tr key={i} className="border-[var(--st-border)]">
                      <Td colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </Td>
                    </Tr>
                  ))
                ) : filtered.length === 0 ? (
                  <Tr className="border-[var(--st-border)]">
                    <Td
                      colSpan={4}
                      className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      {rows.length === 0
                        ? "No types yet — click Add Type to get started."
                        : "No types match this search."}
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((row) => (
                    <Tr
                      key={row._id}
                      className={cn(
                        "border-[var(--st-border)]",
                        selected.has(row._id) && "bg-[var(--st-bg-secondary)]",
                      )}
                    >
                      <Td>
                        <Checkbox
                          checked={selected.has(row._id)}
                          onCheckedChange={() => toggleOne(row._id)}
                          aria-label={`Select ${row.type}`}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <RowDrawer
                          label={row.type}
                          subtitle={row.color ?? undefined}
                          title={`Type · ${row.type}`}
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
                                    className="inline-block h-4 w-4 rounded-sm border border-[var(--st-border)]"
                                    style={{ backgroundColor: row.color }}
                                  />
                                  <code className="text-[12px]">
                                    {row.color}
                                  </code>
                                </div>
                              ) : (
                                <div>—</div>
                              )}
                            </div>
                          </div>
                        </RowDrawer>
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded-sm border border-[var(--st-border)]"
                            style={{ backgroundColor: row.color || "#6B7280" }}
                            aria-label={`Colour ${row.color || ""}`}
                          />
                          <code className="text-[12px] text-[var(--st-text-secondary)]">
                            {row.color || "—"}
                          </code>
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(row._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                          </Button>
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
            <DialogTitle className="text-[var(--st-text)]">
              {editing ? "Edit Type" : "Add Type"}
            </DialogTitle>
            <DialogDescription className="text-[var(--st-text-secondary)]">
              Assign a colour hex code to visually distinguish the type.
            </DialogDescription>
          </DialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="type" className="text-[var(--st-text)]">
                Type <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="type"
                name="type"
                required
                defaultValue={editing?.type || ""}
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Colour</Label>
              <input type="hidden" name="color" value={color} />
              <div className="mt-1.5">
                <ColorPicker value={color} onChange={setColor} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null}
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
            <AlertDialogTitle className="text-[var(--st-text)]">
              Delete Type?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--st-text-secondary)]">
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
