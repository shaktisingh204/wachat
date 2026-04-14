'use client';

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState,
} from 'react';
import Link from 'next/link';
import {
  FileSignature,
  Plus,
  Pencil,
  Trash2,
  Eye,
  LoaderCircle,
} from 'lucide-react';
import {
  getContracts,
  saveContract,
  deleteContract,
} from '@/app/actions/crm-services.actions';
import type { HrContract } from '@/lib/hr-types';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Contract = HrContract & { _id: string };

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'green' | 'red'> = {
  draft: 'neutral',
  sent: 'amber',
  signed: 'green',
  expired: 'red',
  terminated: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ContractsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Contract[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [saveState, saveFormAction, isSaving] = useActionState(saveContract, {
    message: '',
    error: '',
  } as any);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const list = await getContracts();
      setRows((list as Contract[]) || []);
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
    const res = await deleteContract(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Contract removed.' });
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
        title="Contracts"
        subtitle="Prepare, send, and e-sign client contracts."
        icon={FileSignature}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Contract
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Title</TableHead>
                <TableHead className="text-clay-ink-muted">Client</TableHead>
                <TableHead className="text-clay-ink-muted">Value</TableHead>
                <TableHead className="text-clay-ink-muted">Start</TableHead>
                <TableHead className="text-clay-ink-muted">End</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="w-[200px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No contracts yet — click Add Contract to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    <TableCell className="text-[13px] font-medium text-clay-ink">
                      <Link
                        href={`/dashboard/crm/contracts/${row._id}`}
                        className="hover:underline"
                      >
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {row.clientName || '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {row.value != null
                        ? new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: row.currency || 'INR',
                          }).format(row.value)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {fmtDate(row.startDate)}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {fmtDate(row.endDate)}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
                        {row.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/crm/contracts/${row._id}`}>
                          <ClayButton
                            variant="pill"
                            size="sm"
                            leading={<Eye className="h-3.5 w-3.5" />}
                          >
                            {row.status === 'signed' ? 'View' : 'Sign'}
                          </ClayButton>
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
              {editing ? 'Edit Contract' : 'Add Contract'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Fill in the details below.
            </DialogDescription>
          </DialogHeader>

          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-clay-ink">
                  Title <span className="text-clay-red">*</span>
                </Label>
                <Input
                  name="title"
                  required
                  defaultValue={editing?.title || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Client Name</Label>
                <Input
                  name="clientName"
                  defaultValue={editing?.clientName || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">
                  Status <span className="text-clay-red">*</span>
                </Label>
                <Select
                  name="status"
                  defaultValue={editing?.status || 'draft'}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-clay-ink">Value</Label>
                <Input
                  type="number"
                  name="value"
                  defaultValue={editing?.value ?? ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Currency</Label>
                <Input
                  name="currency"
                  defaultValue={editing?.currency || 'INR'}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Start Date</Label>
                <Input
                  type="date"
                  name="startDate"
                  defaultValue={
                    editing?.startDate
                      ? new Date(editing.startDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">End Date</Label>
                <Input
                  type="date"
                  name="endDate"
                  defaultValue={
                    editing?.endDate
                      ? new Date(editing.endDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-clay-ink">Body</Label>
                <Textarea
                  name="body"
                  rows={6}
                  defaultValue={editing?.body || ''}
                  className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
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
              Delete contract?
            </AlertDialogTitle>
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
