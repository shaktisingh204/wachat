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
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
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

import { CrmPageHeader } from '../../_components/crm-page-header';

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
  const { toast } = useZoruToast();
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
          <ZoruButton
           
           
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Add Transaction
          </ZoruButton>
        }
      />

      <ZoruCard>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <ZoruSelect
            value={filterBank || 'all'}
            onValueChange={(v) => setFilterBank(v === 'all' ? '' : v)}
          >
            <ZoruSelectTrigger className="h-9 w-[220px] rounded-lg border-border bg-card text-[12.5px]">
              <ZoruSelectValue placeholder="All accounts" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All accounts</ZoruSelectItem>
              {banks.map((b) => (
                <ZoruSelectItem key={b._id} value={b._id}>
                  {b.accountName}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
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
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-border hover:bg-transparent">
                  <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">
                    Description
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">Category</ZoruTableHead>
                  <ZoruTableHead className="text-right text-muted-foreground">
                    Amount
                  </ZoruTableHead>
                  <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                  <ZoruTableHead className="text-right text-muted-foreground">
                    &nbsp;
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.map((r) => (
                  <ZoruTableRow key={r._id} className="border-border">
                    <ZoruTableCell className="text-[12.5px] text-foreground">
                      {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={(TYPE_TONES[r.type] || 'neutral') as any}>
                        {r.type}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-foreground">
                      {r.description || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-muted-foreground">
                      {r.category || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-semibold text-foreground">
                      {formatMoney(r.amount)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {r.reconciled ? (
                        <ZoruBadge variant="success">
                          <CheckCircle2 className="h-3 w-3" />
                          reconciled
                        </ZoruBadge>
                      ) : (
                        <ZoruBadge variant="warning">pending</ZoruBadge>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruButton
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </ZoruButton>
                      <ZoruButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        )}
      </ZoruCard>

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Transaction' : 'Add Transaction'}
            </ZoruDialogTitle>
          </ZoruDialogHeader>
          <form action={formAction} className="grid gap-3">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div>
              <ZoruLabel htmlFor="bank_account_id">Bank Account</ZoruLabel>
              <ZoruSelect
                name="bank_account_id"
                defaultValue={editing?.bank_account_id || ''}
              >
                <ZoruSelectTrigger
                  id="bank_account_id"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                >
                  <ZoruSelectValue placeholder="Pick account" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {banks.map((b) => (
                    <ZoruSelectItem key={b._id} value={b._id}>
                      {b.accountName}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <ZoruLabel htmlFor="type">Type</ZoruLabel>
                <ZoruSelect name="type" defaultValue={editing?.type || 'deposit'}>
                  <ZoruSelectTrigger
                    id="type"
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  >
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="deposit">deposit</ZoruSelectItem>
                    <ZoruSelectItem value="withdrawal">withdrawal</ZoruSelectItem>
                    <ZoruSelectItem value="transfer">transfer</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel htmlFor="date">Date</ZoruLabel>
                <ZoruInput
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
                <ZoruLabel htmlFor="amount">Amount</ZoruLabel>
                <ZoruInput
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
                <ZoruLabel htmlFor="category">Category</ZoruLabel>
                <ZoruInput
                  id="category"
                  name="category"
                  defaultValue={editing?.category || ''}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="reference">Reference</ZoruLabel>
              <ZoruInput
                id="reference"
                name="reference"
                defaultValue={editing?.reference || ''}
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="description">Description</ZoruLabel>
              <ZoruTextarea
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
            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit">Save</ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete transaction?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onDelete} disabled={isPending}>
              {isPending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
