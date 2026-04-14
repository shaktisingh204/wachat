'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getTicketTypes,
  saveTicketType,
  deleteTicketType,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketType } from '@/lib/worksuite/tickets-ext-types';

type Row = WsTicketType & { _id: string };

export default function TicketTypesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [color, setColor] = useState('#6B7280');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveTicketType,
    { message: '', error: '' } as any,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const data = await getTicketTypes();
      setRows(data as unknown as Row[]);
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
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, refresh, toast]);

  const openAdd = () => {
    setEditing(null);
    setColor('#6B7280');
    setDialogOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setColor(row.color || '#6B7280');
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteTicketType(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Type removed.' });
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
        title="Ticket Types"
        subtitle="Ticket categorisation types with colour coding."
        icon={Tag}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={openAdd}
          >
            Add Type
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Type</TableHead>
                <TableHead className="text-clay-ink-muted">Colour</TableHead>
                <TableHead className="w-[120px] text-right text-clay-ink-muted">
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
                    No types yet — click Add Type to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    <TableCell className="text-[13px] text-clay-ink">
                      {row.type}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-sm border border-clay-border"
                          style={{ backgroundColor: row.color || '#6B7280' }}
                          aria-label={`Colour ${row.color || ''}`}
                        />
                        <code className="text-[12px] text-clay-ink-muted">
                          {row.color || '—'}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Type' : 'Add Type'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Assign a colour hex code to visually distinguish the type.
            </DialogDescription>
          </DialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? <input type="hidden" name="_id" value={editing._id} /> : null}
            <div>
              <Label htmlFor="type" className="text-clay-ink">
                Type <span className="text-clay-red">*</span>
              </Label>
              <Input
                id="type"
                name="type"
                required
                defaultValue={editing?.type || ''}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="color" className="text-clay-ink">
                Colour
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="inline-block h-9 w-9 rounded-clay-md border border-clay-border"
                  style={{ backgroundColor: color || '#6B7280' }}
                  aria-label="Colour preview"
                />
                <Input
                  id="color"
                  name="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#6B7280"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
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
            <AlertDialogTitle className="text-clay-ink">Delete Type?</AlertDialogTitle>
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
