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
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruIconPicker,
  ZoruInput,
  ZoruLabel,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  } from 'lucide-react';
import { useActionState,
  useEffect,
  useState,
  useTransition } from 'react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [icon, setIcon] = useState<string>(editing?.icon ?? '');

  React.useEffect(() => {
    setIcon(editing?.icon ?? '');
  }, [editing]);
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
    <EntityListShell
      title="Custom Modules"
      subtitle="Define bespoke modules with role-scoped view/create/edit/delete permissions."
      primaryAction={
        <ZoruButton
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Custom Module
        </ZoruButton>
      }
    >

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Table</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Icon</ZoruTableHead>
                <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No custom modules yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id}>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {row.display_name || row.name}
                      {row.description ? (
                        <div className="text-[12px] text-zoru-ink-muted">
                          {row.description}
                        </div>
                      ) : null}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="ghost">
                        <code>{row.name}</code>
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                      {row.table || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                      {row.icon || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                          aria-label="Delete"
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

      {rows.length > 0 && roles.length > 0 ? (
        <ZoruCard className="p-0">
          <div className="border-b border-zoru-line p-5">
            <h2 className="text-[15px] text-zoru-ink">Permission matrix</h2>
            <p className="text-[13px] text-zoru-ink-muted">
              For each custom module × role pair, toggle the CRUD flags.
              {isBusy ? (
                <LoaderCircle className="ml-2 inline h-3 w-3 animate-spin" />
              ) : null}
            </p>
          </div>
          <div className="overflow-x-auto p-5">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Module</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Role</ZoruTableHead>
                  <ZoruTableHead className="text-center text-zoru-ink-muted">View</ZoruTableHead>
                  <ZoruTableHead className="text-center text-zoru-ink-muted">Create</ZoruTableHead>
                  <ZoruTableHead className="text-center text-zoru-ink-muted">Edit</ZoruTableHead>
                  <ZoruTableHead className="text-center text-zoru-ink-muted">Delete</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.flatMap((m) =>
                  roles.map((r) => {
                    const p = permFor(m._id, r._id);
                    return (
                      <ZoruTableRow key={`${m._id}:${r._id}`}>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {m.display_name || m.name}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {r.display_name || r.name}
                        </ZoruTableCell>
                        {(
                          ['can_view', 'can_create', 'can_edit', 'can_delete'] as const
                        ).map((key) => (
                          <ZoruTableCell key={key} className="text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-zoru-ink"
                              checked={!!p?.[key]}
                              disabled={isBusy}
                              onChange={() => togglePerm(m._id, r._id, key)}
                              aria-label={`${m.name}/${r.name}/${key}`}
                            />
                          </ZoruTableCell>
                        ))}
                      </ZoruTableRow>
                    );
                  }),
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </ZoruCard>
      ) : null}

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Custom Module' : 'Add Custom Module'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Custom modules are tenant-specific entities with their own
              permission matrix.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <ZoruLabel htmlFor="display_name">
                Display name <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="display_name"
                name="display_name"
                required
                defaultValue={editing?.display_name || ''}
              />
            </div>
            <div>
              <ZoruLabel htmlFor="name">Slug</ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                defaultValue={editing?.name || ''}
              />
            </div>
            <div>
              <ZoruLabel>Icon</ZoruLabel>
              <input type="hidden" name="icon" value={icon} />
              <ZoruIconPicker value={icon} onChange={setIcon} />
            </div>
            <div>
              <ZoruLabel htmlFor="table">Table / collection</ZoruLabel>
              <ZoruInput
                id="table"
                name="table"
                defaultValue={editing?.table || ''}
                placeholder="crm_custom_entity_x"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="description">Description</ZoruLabel>
              <ZoruTextarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description || ''}
              />
            </div>
            <ZoruDialogFooter className="gap-2">
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
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
            <ZoruAlertDialogTitle>Delete custom module?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Its role permissions will also be removed.
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
