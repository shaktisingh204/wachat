'use client';

import * as React from 'react';
import {
  Boxes,
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Modules"
        subtitle="Enable or disable CRM modules and control whether they appear in the menu."
        icon={Boxes}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Module
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Module</TableHead>
                <TableHead className="text-muted-foreground">Slug</TableHead>
                <TableHead className="text-muted-foreground">Active</TableHead>
                <TableHead className="text-muted-foreground">In Menu</TableHead>
                <TableHead className="w-[120px] text-right text-muted-foreground">
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
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No modules yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-border">
                    <TableCell className="text-[13px] font-medium text-foreground">
                      {row.display_name || row.module_name}
                      {row.description ? (
                        <div className="text-[12px] text-muted-foreground">
                          {row.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="neutral">
                        <code>{row.module_name}</code>
                      </ClayBadge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!row.is_active}
                        disabled={isBusy}
                        onCheckedChange={() => flip(row._id, 'active')}
                        aria-label="Toggle active"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!row.in_menu}
                        disabled={isBusy}
                        onCheckedChange={() => flip(row._id, 'menu')}
                        aria-label="Toggle menu"
                      />
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
              {editing ? 'Edit Module' : 'Add Module'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modules group related permissions (e.g. Leads, Tasks).
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="display_name" className="text-foreground">
                Display name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                defaultValue={editing?.display_name || ''}
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="module_name" className="text-foreground">
                Slug
              </Label>
              <Input
                id="module_name"
                name="module_name"
                defaultValue={editing?.module_name || ''}
                placeholder="leads"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="icon" className="text-foreground">
                Icon name (lucide)
              </Label>
              <Input
                id="icon"
                name="icon"
                defaultValue={editing?.icon || ''}
                placeholder="Users"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description || ''}
                className="rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  name="is_active"
                  value="true"
                  defaultChecked={editing?.is_active ?? true}
                  className="h-4 w-4 accent-foreground"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  name="in_menu"
                  value="true"
                  defaultChecked={editing?.in_menu ?? true}
                  className="h-4 w-4 accent-foreground"
                />
                Show in menu
              </label>
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
              Delete module?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Permissions referencing this module will become uncategorised.
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
