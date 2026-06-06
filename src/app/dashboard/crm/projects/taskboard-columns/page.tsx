'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, ColorPicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Kanban,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useActionState,
  useEffect,
  useState,
  useTransition } from 'react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getWsTaskboardColumns,
  saveWsTaskboardColumn,
  deleteWsTaskboardColumn,
} from '@/app/actions/worksuite/projects.actions';
import { reorderTaskboardColumns } from '@/app/actions/worksuite/meta.actions';
import type { WsTaskboardColumn } from '@/lib/worksuite/meta-types';

type ColumnRow = WsTaskboardColumn & { _id: string };

const DEFAULT_COLOR = '#7c3aed';

/**
 * Manage kanban taskboard columns. Supports move-up / move-down
 * reordering and colour customisation via a hex text field with a
 * live preview swatch. (Global columns are rendered when
 * `projectId` is null/undefined.)
 */
export default function TaskboardColumnsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ColumnRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isReordering, startReorder] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ColumnRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [colorPreview, setColorPreview] = useState(DEFAULT_COLOR);
  const [saveState, saveAction, isSaving] = useActionState(
    saveWsTaskboardColumn,
    { message: '', error: '' } as any,
  );

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWsTaskboardColumns()) as ColumnRow[];
        setRows(
          Array.isArray(list)
            ? list.slice().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
            : [],
        );
      } catch (e) {
        console.error('Failed to load columns:', e);
      }
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
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const move = (id: string, dir: -1 | 1) => {
    const idx = rows.findIndex((r) => r._id === id);
    if (idx === -1) return;
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const ordered = [...rows];
    [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
    const ids = ordered.map((r) => r._id);
    startReorder(async () => {
      const res = await reorderTaskboardColumns(ids);
      if (res.success) refresh();
      else
        toast({
          title: 'Error',
          description: res.error || 'Reorder failed',
          variant: 'destructive',
        });
    });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteWsTaskboardColumn(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Column removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const openCreate = () => {
    setEditing(null);
    setColorPreview(DEFAULT_COLOR);
    setDialogOpen(true);
  };
  const openEdit = (row: ColumnRow) => {
    setEditing(row);
    setColorPreview(row.labelColor || DEFAULT_COLOR);
    setDialogOpen(true);
  };

  return (
    <EntityListShell
      title="Taskboard Columns"
      subtitle="Customise the kanban board — reorder, recolour, and add columns."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!rows.length) {
                toast({ title: 'Nothing to export' });
                return;
              }
              const header = ['Name', 'Slug', 'Colour', 'Priority'];
              const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
              const csv = [
                header.join(','),
                ...rows.map((r) =>
                  [
                    escape(r.columnName),
                    escape(r.slug ?? ''),
                    escape(r.labelColor ?? DEFAULT_COLOR),
                    escape(r.priority ?? 0),
                  ].join(','),
                ),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `taskboard-columns-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Column
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            label="Total columns"
            value={rows.length.toLocaleString()}
            icon={<Kanban className="h-4 w-4" />}
          />
          <StatCard
            label="With colour"
            value={rows.filter((r) => (r.labelColor || '').trim().length > 0).length.toLocaleString()}
          />
          <StatCard
            label="Priority range"
            value={
              rows.length > 0
                ? `${Math.min(...rows.map((r) => r.priority ?? 0))} – ${Math.max(...rows.map((r) => r.priority ?? 0))}`
                : '—'
            }
          />
        </div>

      <Card>
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Name</Th>
                <Th className="text-[var(--st-text-secondary)]">Slug</Th>
                <Th className="text-[var(--st-text-secondary)]">Colour</Th>
                <Th className="text-[var(--st-text-secondary)]">Priority</Th>
                <Th className="w-[180px] text-right text-[var(--st-text-secondary)]">
                  Actions
                </Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading && rows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    Loading…
                  </Td>
                </Tr>
              ) : rows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No columns yet — click Add to get started.
                  </Td>
                </Tr>
              ) : (
                rows.map((row, idx) => (
                  <Tr key={row._id} className="border-[var(--st-border)]">
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {row.columnName}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {row.slug || '—'}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-sm border border-[var(--st-border)]"
                          style={{
                            backgroundColor: row.labelColor || DEFAULT_COLOR,
                          }}
                          aria-hidden
                        />
                        <code className="text-[12px] text-[var(--st-text-secondary)]">
                          {row.labelColor || DEFAULT_COLOR}
                        </code>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant="ghost">{row.priority ?? 0}</Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0 || isReordering}
                          onClick={() => move(row._id, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={idx === rows.length - 1 || isReordering}
                          onClick={() => move(row._id, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                          aria-label="Delete"
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--st-text)]">
              {editing ? 'Edit Column' : 'Add Column'}
            </DialogTitle>
            <DialogDescription className="text-[var(--st-text-secondary)]">
              Columns are shown in the kanban board in priority order.
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div>
              <Label htmlFor="columnName" className="text-[var(--st-text)]">
                Column name <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="columnName"
                name="columnName"
                required
                defaultValue={editing?.columnName || ''}
                className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="slug" className="text-[var(--st-text)]">
                Slug
              </Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={editing?.slug || ''}
                placeholder="in-progress"
                className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              />
            </div>

            <div>
              <Label className="text-[var(--st-text)]">Label colour</Label>
              <input type="hidden" name="labelColor" value={colorPreview} />
              <div className="mt-1.5">
                <ColorPicker value={colorPreview} onChange={setColorPreview} />
              </div>
            </div>

            <div>
              <Label htmlFor="priority" className="text-[var(--st-text)]">
                Priority
              </Label>
              <Input
                id="priority"
                name="priority"
                type="number"
                defaultValue={String(editing?.priority ?? rows.length)}
                className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              />
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
              Delete column?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--st-text-secondary)]">
              Existing tasks assigned to this column will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}
