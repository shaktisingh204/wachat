'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruIconPicker,
  Input,
  Label,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
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
  const { toast } = useZoruToast();
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
            <ZoruTableHeader>
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Label</ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Route</ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Icon</ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Position</ZoruTableHead>
                <ZoruTableHead className="text-[var(--st-text-secondary)]">Visible</ZoruTableHead>
                <ZoruTableHead className="w-[200px] text-right text-[var(--st-text-secondary)]">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No menu entries yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row, idx) => (
                  <ZoruTableRow key={row._id}>
                    <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                      {row.label}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-[var(--st-text-secondary)]">
                      <code>{row.route || '—'}</code>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-[var(--st-text-secondary)]">
                      {row.icon || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant="ghost">{row.position ?? idx}</Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Switch
                        checked={!!row.is_visible}
                        disabled={isBusy}
                        onCheckedChange={() => flipVisibility(row._id)}
                        aria-label="Toggle visibility"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
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
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Menu Entry' : 'Add Menu Entry'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Entries appear in the CRM sidebar in position order.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

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
              <ZoruIconPicker value={icon} onChange={setIcon} />
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

            <ZoruDialogFooter className="gap-2">
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
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete menu entry?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This cannot be undone.
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
