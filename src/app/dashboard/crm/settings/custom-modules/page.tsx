'use client';

import * as React from 'react';
import {
  Layers,
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
  getCustomModules,
  saveCustomModule,
  deleteCustomModule,
  getCustomModulePermissions,
  setCustomModulePermission,
  getRoles,
} from '@/app/actions/worksuite/rbac.actions';
import type {
  WsCustomModule,
  WsCustomModulePermission,
  WsRole,
} from '@/lib/worksuite/rbac-types';

type Row = WsCustomModule & { _id: string };
type RoleRow = WsRole & { _id: string };
type PermRow = WsCustomModulePermission & { _id: string };

type Flags = {
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
};

export default function CustomModulesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveAction, isSaving] = useActionState(saveCustomModule, {
    message: '',
    error: '',
  } as any);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [m, r, p] = await Promise.all([
        getCustomModules(),
        getRoles(),
        getCustomModulePermissions(),
      ]);
      setRows((m as Row[]) || []);
      setRoles((r as RoleRow[]) || []);
      setPerms((p as PermRow[]) || []);
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

  const permFor = (moduleId: string, roleId: string): PermRow | undefined =>
    perms.find(
      (p) =>
        String(p.custom_module_id) === moduleId &&
        String(p.role_id) === roleId,
    );

  const togglePerm = (
    moduleId: string,
    roleId: string,
    key: keyof Flags,
  ) => {
    const existing = permFor(moduleId, roleId);
    const current: Flags = existing
      ? {
          can_view: !!existing.can_view,
          can_create: !!existing.can_create,
          can_edit: !!existing.can_edit,
          can_delete: !!existing.can_delete,
        }
      : {};
    const next: Flags = { ...current, [key]: !current[key] };
    startBusy(async () => {
      const res = await setCustomModulePermission(moduleId, roleId, next);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error || 'Failed',
          variant: 'destructive',
        });
        return;
      }
      refresh();
    });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteCustomModule(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Custom module removed.' });
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
        title="Custom Modules"
        subtitle="Define bespoke modules with role-scoped view/create/edit/delete permissions."
        icon={Layers}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Custom Module
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Name</TableHead>
                <TableHead className="text-clay-ink-muted">Slug</TableHead>
                <TableHead className="text-clay-ink-muted">Table</TableHead>
                <TableHead className="text-clay-ink-muted">Icon</TableHead>
                <TableHead className="w-[120px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    No custom modules yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    <TableCell className="text-[13px] font-medium text-clay-ink">
                      {row.display_name || row.name}
                      {row.description ? (
                        <div className="text-[12px] text-clay-ink-muted">
                          {row.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="neutral">
                        <code>{row.name}</code>
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-[12px] text-clay-ink-muted">
                      {row.table || '—'}
                    </TableCell>
                    <TableCell className="text-[12px] text-clay-ink-muted">
                      {row.icon || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
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

      {rows.length > 0 && roles.length > 0 ? (
        <ClayCard>
          <div className="border-b border-clay-border p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink">
              Permission matrix
            </h2>
            <p className="text-[13px] text-clay-ink-muted">
              For each custom module × role pair, toggle the CRUD flags.
              {isBusy ? (
                <LoaderCircle className="ml-2 inline h-3 w-3 animate-spin" />
              ) : null}
            </p>
          </div>
          <div className="overflow-x-auto p-5">
            <Table>
              <TableHeader>
                <TableRow className="border-clay-border hover:bg-transparent">
                  <TableHead className="text-clay-ink-muted">Module</TableHead>
                  <TableHead className="text-clay-ink-muted">Role</TableHead>
                  <TableHead className="text-center text-clay-ink-muted">
                    View
                  </TableHead>
                  <TableHead className="text-center text-clay-ink-muted">
                    Create
                  </TableHead>
                  <TableHead className="text-center text-clay-ink-muted">
                    Edit
                  </TableHead>
                  <TableHead className="text-center text-clay-ink-muted">
                    Delete
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.flatMap((m) =>
                  roles.map((r) => {
                    const p = permFor(m._id, r._id);
                    return (
                      <TableRow
                        key={`${m._id}:${r._id}`}
                        className="border-clay-border"
                      >
                        <TableCell className="text-[13px] text-clay-ink">
                          {m.display_name || m.name}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink-muted">
                          {r.display_name || r.name}
                        </TableCell>
                        {(
                          ['can_view', 'can_create', 'can_edit', 'can_delete'] as const
                        ).map((key) => (
                          <TableCell key={key} className="text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-clay-ink"
                              checked={!!p?.[key]}
                              disabled={isBusy}
                              onChange={() => togglePerm(m._id, r._id, key)}
                              aria-label={`${m.name}/${r.name}/${key}`}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  }),
                )}
              </TableBody>
            </Table>
          </div>
        </ClayCard>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Custom Module' : 'Add Custom Module'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Custom modules are tenant-specific entities with their own
              permission matrix.
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
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="icon" className="text-clay-ink">
                Icon name (lucide)
              </Label>
              <Input
                id="icon"
                name="icon"
                defaultValue={editing?.icon || ''}
                placeholder="Layers"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="table" className="text-clay-ink">
                Table / collection
              </Label>
              <Input
                id="table"
                name="table"
                defaultValue={editing?.table || ''}
                placeholder="crm_custom_entity_x"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-clay-ink">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description || ''}
                className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
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
            <AlertDialogTitle className="text-clay-ink">
              Delete custom module?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              Its role permissions will also be removed.
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
