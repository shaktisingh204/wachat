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
  ZoruSwitch,
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
  getModules,
  saveModule,
  deleteModule,
  toggleModule,
  toggleModuleInMenu,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsModule } from '@/lib/worksuite/rbac-types';

type Row = WsModule & { _id: string };

export default function ModulesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveAction, isSaving] = useActionState(saveModule, {
    message: '',
    error: '',
  } as any);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const list = (await getModules()) as Row[];
      setRows(Array.isArray(list) ? list : []);
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

  const flip = (id: string, which: 'active' | 'menu') =>
    startBusy(async () => {
      const res =
        which === 'active'
          ? await toggleModule(id)
          : await toggleModuleInMenu(id);
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
    const res = await deleteModule(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Module removed.' });
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
      title="Modules"
      subtitle="Enable or disable CRM modules and control whether they appear in the menu."
      primaryAction={
        <ZoruButton
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Module
        </ZoruButton>
      }
    >

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Module</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Active</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">In Menu</ZoruTableHead>
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
                    No modules yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id}>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {row.display_name || row.module_name}
                      {row.description ? (
                        <div className="text-[12px] text-zoru-ink-muted">
                          {row.description}
                        </div>
                      ) : null}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="ghost">
                        <code>{row.module_name}</code>
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruSwitch
                        checked={!!row.is_active}
                        disabled={isBusy}
                        onCheckedChange={() => flip(row._id, 'active')}
                        aria-label="Toggle active"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruSwitch
                        checked={!!row.in_menu}
                        disabled={isBusy}
                        onCheckedChange={() => flip(row._id, 'menu')}
                        aria-label="Toggle menu"
                      />
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

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Module' : 'Add Module'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Modules group related permissions (e.g. Leads, Tasks).
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
              <ZoruLabel htmlFor="module_name">Slug</ZoruLabel>
              <ZoruInput
                id="module_name"
                name="module_name"
                defaultValue={editing?.module_name || ''}
                placeholder="leads"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="icon">Icon name (lucide)</ZoruLabel>
              <ZoruInput
                id="icon"
                name="icon"
                defaultValue={editing?.icon || ''}
                placeholder="Users"
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
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                <input
                  type="checkbox"
                  name="is_active"
                  value="true"
                  defaultChecked={editing?.is_active ?? true}
                  className="h-4 w-4 accent-zoru-ink"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                <input
                  type="checkbox"
                  name="in_menu"
                  value="true"
                  defaultChecked={editing?.in_menu ?? true}
                  className="h-4 w-4 accent-zoru-ink"
                />
                Show in menu
              </label>
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
            <ZoruAlertDialogTitle>Delete module?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Permissions referencing this module will become uncategorised.
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
