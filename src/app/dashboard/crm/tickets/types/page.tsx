'use client';

/**
 * Ticket Types — §1D.4 bar:
 *  - KPI strip (Total · With colour · Distinct colours)
 *  - Search across type name
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on type name
 */

import * as React from 'react';
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
  Card,
  Checkbox,
  ZoruColorPicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
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
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import {
  getTicketTypes,
  saveTicketType,
  deleteTicketType,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketType } from '@/lib/worksuite/tickets-ext-types';

type Row = WsTicketType & { _id: string };

function buildCsv(rows: Row[]): string {
  const header = ['Type', 'Colour'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    header.join(','),
    ...rows.map((r) => [escape(r.type), escape(r.color ?? '')].join(',')),
  ].join('\n');
}

export default function TicketTypesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [color, setColor] = useState('#6B7280');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveTicketType,
    { message: '', error: '' } as { message: string; error: string },
  );

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
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, refresh, toast]);

  const openAdd = () => {
    setEditing(null);
    setColor('#6B7280');
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setColor(row.color || '#6B7280');
    setDialogOpen(true);
  };

  /* ── Filter ───────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.type.toLowerCase().includes(q));
  }, [rows, search]);

  /* ── KPIs ─────────────────────────────────────────────────────── */

  const kpis = useMemo(() => ({
    total: rows.length,
    withColour: rows.filter((r) => (r.color || '').trim().length > 0).length,
    distinctColours: new Set(rows.map((r) => (r.color || '').toLowerCase()).filter(Boolean)).size,
  }), [rows]);

  /* ── Selection ────────────────────────────────────────────────── */

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r._id));
  const someSelected = !allSelected && filtered.some((r) => selected.has(r._id));

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
      toast({ title: 'Deleted', description: 'Type removed.' });
      setDeletingId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deletingId);
        return next;
      });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
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
      title: 'Bulk delete',
      description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
      variant: failed > 0 ? 'destructive' : undefined,
    });
    refresh();
  };

  /* ── CSV export ───────────────────────────────────────────────── */

  const handleExportCsv = () => {
    const src =
      selected.size > 0 ? filtered.filter((r) => selected.has(r._id)) : filtered;
    if (!src.length) {
      toast({ title: 'Nothing to export' });
      return;
    }
    const csv = buildCsv(src);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
        placeholder: 'Search types…',
      }}
      primaryAction={
        <ZoruButton onClick={openAdd}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Type
        </ZoruButton>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-zoru-ink">{selected.size} selected</span>
            <span className="text-zoru-ink-muted">·</span>
            <ZoruButton
              variant="ghost"
              size="sm"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
              Delete
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
            <span className="ml-auto" />
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </ZoruButton>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <ZoruStatCard
            label="Total types"
            value={kpis.total.toLocaleString()}
            icon={<Tag className="h-4 w-4" />}
          />
          <ZoruStatCard
            label="With colour"
            value={kpis.withColour.toLocaleString()}
            icon={<Palette className="h-4 w-4" />}
          />
          <ZoruStatCard
            label="Distinct colours"
            value={kpis.distinctColours.toLocaleString()}
            icon={<SwatchBook className="h-4 w-4" />}
          />
        </div>

        {/* Export toolbar when nothing selected */}
        {selected.size === 0 ? (
          <div className="flex justify-end">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
          </div>
        ) : null}

        <ZoruCard className="p-6">
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10">
                    <ZoruCheckbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Colour</ZoruTableHead>
                  <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && rows.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <ZoruTableRow key={i} className="border-zoru-line">
                      <ZoruTableCell colSpan={4}>
                        <ZoruSkeleton className="h-8 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell
                      colSpan={4}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {rows.length === 0
                        ? 'No types yet — click Add Type to get started.'
                        : 'No types match this search.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((row) => (
                    <ZoruTableRow
                      key={row._id}
                      className={cn('border-zoru-line', selected.has(row._id) && 'bg-zoru-surface')}
                    >
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={selected.has(row._id)}
                          onCheckedChange={() => toggleOne(row._id)}
                          aria-label={`Select ${row.type}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        <RowDrawer
                          label={row.type}
                          subtitle={row.color ?? undefined}
                          title={`Type · ${row.type}`}
                          description="Use the row Edit action to change this type."
                        >
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Type name</div>
                              <div>{row.type}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Colour</div>
                              {row.color ? (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-4 w-4 rounded-sm border border-zoru-line"
                                    style={{ backgroundColor: row.color }}
                                  />
                                  <code className="text-[12px]">{row.color}</code>
                                </div>
                              ) : (
                                <div>—</div>
                              )}
                            </div>
                          </div>
                        </RowDrawer>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 rounded-sm border border-zoru-line"
                            style={{ backgroundColor: row.color || '#6B7280' }}
                            aria-label={`Colour ${row.color || ''}`}
                          />
                          <code className="text-[12px] text-zoru-ink-muted">
                            {row.color || '—'}
                          </code>
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton variant="ghost" size="sm" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(row._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                          </ZoruButton>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </ZoruCard>
      </div>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {editing ? 'Edit Type' : 'Add Type'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Assign a colour hex code to visually distinguish the type.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? <input type="hidden" name="_id" value={editing._id} /> : null}
            <div>
              <ZoruLabel htmlFor="type" className="text-zoru-ink">
                Type <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="type"
                name="type"
                required
                defaultValue={editing?.type || ''}
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Colour</ZoruLabel>
              <input type="hidden" name="color" value={color} />
              <div className="mt-1.5">
                <ZoruColorPicker value={color} onChange={setColor} />
              </div>
            </div>
            <ZoruDialogFooter className="gap-2">
              <ZoruButton type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null}
                Save
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">Delete Type?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
