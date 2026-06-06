'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, IconPicker, Input, Label, Switch, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  LoaderCircle,
  } from 'lucide-react';
import { useActionState,
  useEffect,
  useState,
  useTransition } from 'react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getMenu,
  saveMenu,
  deleteMenu,
  toggleMenuVisibility,
  reorderMenu,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsMenu } from '@/lib/worksuite/rbac-types';

type Row = WsMenu & { _id: string };

/**
 * Sidebar menu config — tenant admins can add/edit entries, toggle
 * visibility, and reorder with up/down arrows (Worksuite's menu
 * settings screen).
 */
export default function MenuSettingsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isReordering, startReorder] = useTransition();
  const [isBusy, startBusy] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [icon, setIcon] = useState<string>(editing?.icon ?? '');

  React.useEffect(() => {
    setIcon(editing?.icon ?? '');
  }, [editing]);
  const [saveState, saveAction, isSaving] = useActionState(saveMenu, {
    message: '',
    error: '',
  } as any);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const list = ((await getMenu()) as Row[]) || [];
      setRows(
        list.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      );
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
    startReorder(async () => {
      const res = await reorderMenu(ordered.map((r) => r._id));
      if (res.success) {
        setRows(ordered);
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Reorder failed',
          variant: 'destructive',
        });
      }
    });
  };

  const flipVisibility = (id: string) =>
    startBusy(async () => {
      const res = await toggleMenuVisibility(id);
      if (res.success) refresh();
      else
        toast({
          title: 'Error',
          description: res.error || 'Toggle failed',
          variant: 'destructive',
        });
    });

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteMenu(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Menu entry removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <EntityListShell
      title="Sidebar Menu"
      subtitle="Configure sidebar entries. Reorder with the arrows; toggle to hide."
      primaryAction={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
      }
    >

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">Label</Th>
                <Th className="text-[var(--st-text-secondary)]">Route</Th>
                <Th className="text-[var(--st-text-secondary)]">Icon</Th>
                <Th className="text-[var(--st-text-secondary)]">Position</Th>
                <Th className="text-[var(--st-text-secondary)]">Visible</Th>
                <Th className="w-[200px] text-right text-[var(--st-text-secondary)]">
                  Actions
                </Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading && rows.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </Td>
                </Tr>
              ) : rows.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No menu entries yet.
                  </Td>
                </Tr>
              ) : (
                rows.map((row, idx) => (
                  <Tr key={row._id}>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {row.label}
                    </Td>
                    <Td className="text-[12px] text-[var(--st-text-secondary)]">
                      <code>{row.route || '—'}</code>
                    </Td>
                    <Td className="text-[12px] text-[var(--st-text-secondary)]">
                      {row.icon || '—'}
                    </Td>
                    <Td>
                      <Badge variant="ghost">{row.position ?? idx}</Badge>
                    </Td>
                    <Td>
                      <Switch
                        checked={!!row.is_visible}
                        disabled={isBusy}
                        onCheckedChange={() => flipVisibility(row._id)}
                        aria-label="Toggle visibility"
                      />
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
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Menu Entry' : 'Add Menu Entry'}
            </DialogTitle>
            <DialogDescription>
              Entries appear in the CRM sidebar in position order.
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="label">
                Label <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="label"
                name="label"
                required
                defaultValue={editing?.label || ''}
              />
            </div>
            <div>
              <Label htmlFor="route">Route</Label>
              <Input
                id="route"
                name="route"
                defaultValue={editing?.route || ''}
                placeholder="/dashboard/crm/leads"
              />
            </div>
            <div>
              <Label>Icon</Label>
              <input type="hidden" name="icon" value={icon} />
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div>
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                name="position"
                type="number"
                defaultValue={String(editing?.position ?? rows.length)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_visible"
                type="checkbox"
                name="is_visible"
                value="true"
                defaultChecked={editing?.is_visible ?? true}
                className="h-4 w-4 accent-[var(--st-text)]"
              />
              <Label htmlFor="is_visible" className="text-[13px] text-[var(--st-text)]">
                Visible
              </Label>
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
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
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
            <AlertDialogTitle>Delete menu entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
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
