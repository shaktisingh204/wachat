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
  const { toast } = useToast();
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
            <ClayButton
              variant="pill"
              disabled={isSeeding}
              leading={
                isSeeding ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                )
              }
              onClick={doSeed}
            >
              Seed defaults
            </ClayButton>
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              Add Type
            </ClayButton>
          </div>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Name</TableHead>
                <TableHead className="text-clay-ink-muted">Display</TableHead>
                <TableHead className="w-[120px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={3}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={3}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    No permission types — click &quot;Seed defaults&quot;.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    <TableCell>
                      <ClayBadge tone="neutral">{row.name}</ClayBadge>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {row.display_name || '—'}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Type' : 'Add Type'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Standard names are none / all / added / owned / both.
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="name" className="text-clay-ink">
                Name <span className="text-clay-red">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={editing?.name || ''}
                placeholder="all"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="display_name" className="text-clay-ink">
                Display name
              </Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={editing?.display_name || ''}
                placeholder="All"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
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
              Delete type?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              Grants that reference this type will lose their type — re-seed
              afterwards to restore defaults.
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
