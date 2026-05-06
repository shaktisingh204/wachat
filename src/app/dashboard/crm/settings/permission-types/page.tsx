'use client';

import * as React from 'react';
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  LoaderCircle,
} from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';

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
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getPermissionTypes,
  savePermissionType,
  deletePermissionType,
  seedPermissionTypes,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsPermissionType } from '@/lib/worksuite/rbac-types';

type Row = WsPermissionType & { _id: string };

/**
 * Permission Types — the vocabulary (none / all / added / owned / both)
 * used when granting permissions. Usually seeded once per tenant.
 */
export default function PermissionTypesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isSeeding, startSeed] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveAction, isSaving] = useActionState(
    savePermissionType,
    { message: '', error: '' } as any,
  );

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const list = (await getPermissionTypes()) as Row[];
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

  const doSeed = () =>
    startSeed(async () => {
      const res = await seedPermissionTypes();
      toast({
        title: 'Seeded',
        description: `Inserted ${res.inserted} types.`,
      });
      refresh();
    });

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deletePermissionType(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Type removed.' });
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
        title="Permission Types"
        subtitle="The scope vocabulary used when granting a permission to a role."
        icon={ListChecks}
        actions={
          <div className="flex gap-2">
            <ZoruButton
              variant="outline"
              disabled={isSeeding}
              onClick={doSeed}
            >
              {isSeeding ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Seed defaults
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Type
            </ZoruButton>
          </div>
        }
      />

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Display</ZoruTableHead>
                <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={3}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={3}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No permission types — click &quot;Seed defaults&quot;.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id}>
                    <ZoruTableCell>
                      <ZoruBadge variant="ghost">{row.name}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {row.display_name || '—'}
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
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Type' : 'Add Type'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Standard names are none / all / added / owned / both.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <ZoruLabel htmlFor="name">
                Name <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                required
                defaultValue={editing?.name || ''}
                placeholder="all"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="display_name">Display name</ZoruLabel>
              <ZoruInput
                id="display_name"
                name="display_name"
                defaultValue={editing?.display_name || ''}
                placeholder="All"
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
            <ZoruAlertDialogTitle>Delete type?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Grants that reference this type will lose their type — re-seed
              afterwards to restore defaults.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
