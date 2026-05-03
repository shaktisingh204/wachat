'use client';

import * as React from 'react';
import {
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  LoaderCircle,
} from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Taskboard Columns"
        subtitle="Customise the kanban board — reorder, recolour, and add columns."
        icon={LayoutGrid}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={openCreate}
          >
            Add Column
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Slug</TableHead>
                <TableHead className="text-muted-foreground">Colour</TableHead>
                <TableHead className="text-muted-foreground">Priority</TableHead>
                <TableHead className="w-[180px] text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No columns yet — click Add to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow key={row._id} className="border-border">
                    <TableCell className="text-[13px] text-foreground">
                      {row.columnName}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {row.slug || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-sm border border-border"
                          style={{
                            backgroundColor: row.labelColor || DEFAULT_COLOR,
                          }}
                          aria-hidden
                        />
                        <code className="text-[12px] text-muted-foreground">
                          {row.labelColor || DEFAULT_COLOR}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="neutral">{row.priority ?? 0}</ClayBadge>
                    </TableCell>
                    <TableCell className="text-right">
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
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editing ? 'Edit Column' : 'Add Column'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Columns are shown in the kanban board in priority order.
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div>
              <Label htmlFor="columnName" className="text-foreground">
                Column name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="columnName"
                name="columnName"
                required
                defaultValue={editing?.columnName || ''}
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="slug" className="text-foreground">
                Slug
              </Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={editing?.slug || ''}
                placeholder="in-progress"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="labelColor" className="text-foreground">
                Label colour (hex)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="labelColor"
                  name="labelColor"
                  defaultValue={editing?.labelColor || DEFAULT_COLOR}
                  placeholder="#7c3aed"
                  onChange={(e) => setColorPreview(e.target.value)}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
                <span
                  className="inline-block h-8 w-8 shrink-0 rounded-lg border border-border"
                  style={{ backgroundColor: colorPreview }}
                  aria-label="Colour preview"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="priority" className="text-foreground">
                Priority
              </Label>
              <Input
                id="priority"
                name="priority"
                type="number"
                defaultValue={String(editing?.priority ?? rows.length)}
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <DialogFooter className="gap-2">
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null
                }
              >
                Save
              </ClayButton>
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
            <AlertDialogTitle className="text-foreground">
              Delete column?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Existing tasks assigned to this column will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
