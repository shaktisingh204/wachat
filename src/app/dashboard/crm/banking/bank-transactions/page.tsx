'use client';

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState,
} from 'react';
import {
  ArrowLeftRight,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  CheckCircle2,
} from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getBankTransactionsExt,
  saveBankTransactionExt,
  deleteBankTransactionExt,
} from '@/app/actions/worksuite/payments.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';

const TYPE_TONES: Record<string, 'green' | 'red' | 'blue'> = {
  deposit: 'green',
  withdrawal: 'red',
  transfer: 'blue',
};

function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  } catch {
    return `${currency} ${amount || 0}`;
  }
}

export default function BankTransactionsExtPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [filterBank, setFilterBank] = useState('');
  const [isLoading, startLoad] = useTransition();
  const [isPending, startPending] = useTransition();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [state, formAction] = useActionState(saveBankTransactionExt, {});

  const load = useCallback(() => {
    startLoad(async () => {
      const data = await getBankTransactionsExt(filterBank || undefined);
      setRows((data || []) as any[]);
    });
  }, [filterBank]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const b = await getCrmPaymentAccounts();
      setBanks((b || []).filter((x: any) => x.accountType === 'bank'));
    })();
  }, []);

  useEffect(() => {
    if (state.message) {
      toast({ title: state.message });
      setOpen(false);
      setEditing(null);
      load();
    } else if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onDelete = () => {
    if (!confirmDelete) return;
    startPending(async () => {
      const r = await deleteBankTransactionExt(confirmDelete._id);
      if (r.success) toast({ title: 'Transaction deleted.' });
      else
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      setConfirmDelete(null);
      load();
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Bank Transactions (ext)"
        subtitle="Extended ledger — deposits, withdrawals, transfers. Auto-populated by payments & refunds."
        icon={ArrowLeftRight}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Add Transaction
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            value={filterBank || 'all'}
            onValueChange={(v) => setFilterBank(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="h-9 w-[220px] rounded-lg border-border bg-card text-[12.5px]">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {banks.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    &nbsp;
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id} className="border-border">
                    <TableCell className="text-[12.5px] text-foreground">
                      {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={TYPE_TONES[r.type] || 'neutral'}>
                        {r.type}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-[12.5px] text-foreground">
                      {r.description || '—'}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {r.category || '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatMoney(r.amount)}
                    </TableCell>
                    <TableCell>
                      {r.reconciled ? (
                        <ClayBadge tone="green">
                          <CheckCircle2 className="h-3 w-3" />
                          reconciled
                        </ClayBadge>
                      ) : (
                        <ClayBadge tone="amber">pending</ClayBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ClayCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Transaction' : 'Add Transaction'}
            </DialogTitle>
          </DialogHeader>
          <form action={formAction} className="grid gap-3">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div>
              <Label htmlFor="bank_account_id">Bank Account</Label>
              <Select
                name="bank_account_id"
                defaultValue={editing?.bank_account_id || ''}
              >
                <SelectTrigger
                  id="bank_account_id"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                >
                  <SelectValue placeholder="Pick account" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select name="type" defaultValue={editing?.type || 'deposit'}>
                  <SelectTrigger
                    id="type"
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">deposit</SelectItem>
                    <SelectItem value="withdrawal">withdrawal</SelectItem>
                    <SelectItem value="transfer">transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={
                    editing?.date
                      ? new Date(editing.date).toISOString().slice(0, 10)
                      : new Date().toISOString().slice(0, 10)
                  }
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editing?.amount ?? ''}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  defaultValue={editing?.category || ''}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                name="reference"
                defaultValue={editing?.reference || ''}
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={editing?.description || ''}
                className="rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground">
              <input
                type="checkbox"
                name="reconciled"
                defaultChecked={!!editing?.reconciled}
                className="h-4 w-4 accent-primary"
              />
              Reconciled
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={isPending}>
              {isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
