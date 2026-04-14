'use client';

import * as React from 'react';
import {
  KeyRound,
  Plus,
  Pencil,
  Trash2,
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getPermissionsGroupedByModule,
  getModules,
  savePermission,
  deletePermission,
} from '@/app/actions/worksuite/rbac.actions';
import type {
  WsPermission,
  WsModule,
} from '@/lib/worksuite/rbac-types';

type PermRow = WsPermission & { _id: string };
type ModRow = WsModule & { _id: string };
type Group = { module: ModRow | null; permissions: PermRow[] };

export default function PermissionsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [modules, setModules] = useState<ModRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PermRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveAction, isSaving] = useActionState(savePermission, {
    message: '',
    error: '',
  } as any);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [g, m] = await Promise.all([
        getPermissionsGroupedByModule(),
        getModules(),
      ]);
      setGroups((g as Group[]) || []);
      setModules((m as ModRow[]) || []);
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

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deletePermission(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Permission removed.' });
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Permissions"
        subtitle="Grouped by module. Create granular permissions to reference from roles."
        icon={KeyRound}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Permission
          </ClayButton>
        }
      />

      {isLoading && groups.length === 0 ? (
        <ClayCard>
          <div className="flex h-40 items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
          </div>
        </ClayCard>
      ) : groups.length === 0 ? (
        <ClayCard>
          <div className="p-8 text-center text-[13px] text-clay-ink-muted">
            No permissions yet.
          </div>
        </ClayCard>
      ) : (
        groups.map((g, gi) => (
          <ClayCard key={g.module?._id || `orphan-${gi}`}>
            <div className="flex items-center justify-between border-b border-clay-border p-4">
              <div>
                <h2 className="text-[15px] font-semibold text-clay-ink">
                  {g.module?.display_name ||
                    g.module?.module_name ||
                    'Uncategorised'}
                </h2>
                <p className="text-[12px] text-clay-ink-muted">
                  {g.permissions.length} permission(s)
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-clay-border hover:bg-transparent">
                    <TableHead className="text-clay-ink-muted">Name</TableHead>
                    <TableHead className="text-clay-ink-muted">Slug</TableHead>
                    <TableHead className="text-clay-ink-muted">Custom</TableHead>
                    <TableHead className="w-[140px] text-right text-clay-ink-muted">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.permissions.length === 0 ? (
                    <TableRow className="border-clay-border">
                      <TableCell
                        colSpan={4}
                        className="h-14 text-center text-[13px] text-clay-ink-muted"
                      >
                        No permissions.
                      </TableCell>
                    </TableRow>
                  ) : (
                    g.permissions.map((p) => (
                      <TableRow key={p._id} className="border-clay-border">
                        <TableCell className="text-[13px] text-clay-ink">
                          {p.display_name || p.name}
                          {p.description ? (
                            <div className="text-[12px] text-clay-ink-muted">
                              {p.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-[12px] text-clay-ink-muted">
                          <code>{p.name}</code>
                        </TableCell>
                        <TableCell>
                          <ClayBadge tone={p.is_custom ? 'green' : 'neutral'}>
                            {p.is_custom ? 'Custom' : 'Built-in'}
                          </ClayBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(p);
                                setDialogOpen(true);
                              }}
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(p._id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-clay-red" />
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
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Permission' : 'Add Permission'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Permissions belong to a module and are assigned to roles with a
              type (all / added / owned / both / none).
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="display_name" className="text-clay-ink">
                Display name <span className="text-clay-red">*</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                defaultValue={editing?.display_name || ''}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="name" className="text-clay-ink">
                Slug
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name || ''}
                placeholder="auto_generated"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="module_id" className="text-clay-ink">
                Module
              </Label>
              <select
                id="module_id"
                name="module_id"
                defaultValue={editing?.module_id ? String(editing.module_id) : ''}
                className="h-10 w-full rounded-clay-md border border-clay-border bg-clay-surface px-3 text-[13px]"
              >
                <option value="">— None —</option>
                {modules.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.display_name || m.module_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="description" className="text-clay-ink">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={editing?.description || ''}
                className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_custom"
                type="checkbox"
                name="is_custom"
                value="true"
                defaultChecked={!!editing?.is_custom}
                className="h-4 w-4 accent-clay-ink"
              />
              <Label htmlFor="is_custom" className="text-[13px] text-clay-ink">
                Custom (user-defined)
              </Label>
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
            <AlertDialogTitle className="text-clay-ink">
              Delete permission?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              All role and user grants for this permission will be removed.
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
