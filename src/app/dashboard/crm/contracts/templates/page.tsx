'use client';

import { useEffect, useState, useTransition, useActionState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  ExternalLink,
} from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getContractTemplates,
  saveContractTemplate,
  deleteContractTemplate,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractTemplate } from '@/lib/worksuite/contracts-ext-types';

type Row = WsContractTemplate & { _id: string };

export default function ContractTemplatesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveContractTemplate,
    { message: '', error: '' } as any,
  );

  const refresh = () => {
    startLoading(async () => {
      const data = await getContractTemplates();
      setRows(data as unknown as Row[]);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteContractTemplate(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Template removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Contract Templates"
        subtitle="Reusable contract templates with placeholders."
        icon={FileText}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Template
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Name</TableHead>
                <TableHead className="text-clay-ink-muted">Preview</TableHead>
                <TableHead className="w-[160px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No templates yet — click Add Template to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    <TableCell className="text-[13px] text-clay-ink">
                      {row.name}
                    </TableCell>
                    <TableCell className="max-w-[400px] truncate text-[13px] text-clay-ink-muted">
                      {(row.body || '').slice(0, 120)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/crm/contracts/templates/${row._id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Template' : 'Add Template'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Placeholders like {'{{client_name}}'} are supported.
            </DialogDescription>
          </DialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? <input type="hidden" name="_id" value={editing._id} /> : null}
            <div>
              <Label htmlFor="name" className="text-clay-ink">
                Template Name <span className="text-clay-red">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={editing?.name || ''}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="body" className="text-clay-ink">
                Body <span className="text-clay-red">*</span>
              </Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={10}
                defaultValue={editing?.body || ''}
                className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                placeholder="Contract body with placeholders like {{client_name}}, {{start_date}}…"
              />
            </div>
            <DialogFooter className="gap-2">
              <ClayButton type="button" variant="pill" onClick={() => setDialogOpen(false)}>
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
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
            <AlertDialogTitle className="text-clay-ink">Delete Template?</AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
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
