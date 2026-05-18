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
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Permissions"
      subtitle="Grouped by module. Create granular permissions to reference from roles."
      primaryAction={
        <ZoruButton
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Permission
        </ZoruButton>
      }
    >

      {isLoading && groups.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="flex h-40 items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          </div>
        </ZoruCard>
      ) : groups.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="p-8 text-center text-[13px] text-zoru-ink-muted">
            No permissions yet.
          </div>
        </ZoruCard>
      ) : (
        groups.map((g, gi) => (
          <ZoruCard key={g.module?._id || `orphan-${gi}`} className="p-0">
            <div className="flex items-center justify-between border-b border-zoru-line p-4">
              <div>
                <h2 className="text-[15px] text-zoru-ink">
                  {g.module?.display_name ||
                    g.module?.module_name ||
                    'Uncategorised'}
                </h2>
                <p className="text-[12px] text-zoru-ink-muted">
                  {g.permissions.length} permission(s)
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="hover:bg-transparent">
                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Custom</ZoruTableHead>
                    <ZoruTableHead className="w-[140px] text-right text-zoru-ink-muted">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {g.permissions.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell
                        colSpan={4}
                        className="h-14 text-center text-[13px] text-zoru-ink-muted"
                      >
                        No permissions.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    g.permissions.map((p) => (
                      <ZoruTableRow key={p._id}>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {p.display_name || p.name}
                          {p.description ? (
                            <div className="text-[12px] text-zoru-ink-muted">
                              {p.description}
                            </div>
                          ) : null}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                          <code>{p.name}</code>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <ZoruBadge variant={p.is_custom ? 'success' : 'ghost'}>
                            {p.is_custom ? 'Custom' : 'Built-in'}
                          </ZoruBadge>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(p);
                                setDialogOpen(true);
                              }}
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(p._id)}
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
        ))
      )}

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Permission' : 'Add Permission'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Permissions belong to a module and are assigned to roles with a
              type (all / added / owned / both / none).
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
                placeholder="auto_generated"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="module_id">Module</ZoruLabel>
              <select
                id="module_id"
                name="module_id"
                defaultValue={editing?.module_id ? String(editing.module_id) : ''}
                className="h-10 w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
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
              <ZoruLabel htmlFor="description">Description</ZoruLabel>
              <ZoruTextarea
                id="description"
                name="description"
                rows={3}
                defaultValue={editing?.description || ''}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_custom"
                type="checkbox"
                name="is_custom"
                value="true"
                defaultChecked={!!editing?.is_custom}
                className="h-4 w-4 accent-zoru-ink"
              />
              <ZoruLabel htmlFor="is_custom" className="text-[13px] text-zoru-ink">
                Custom (user-defined)
              </ZoruLabel>
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
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
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
            <ZoruAlertDialogTitle>Delete permission?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              All role and user grants for this permission will be removed.
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
