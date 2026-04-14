'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, LoaderCircle, Save, ChevronLeft } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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
import { useToast } from '@/hooks/use-toast';
import { recordPayment } from '@/app/actions/worksuite/payments.actions';
import {
  getOfflinePaymentMethods,
} from '@/app/actions/worksuite/payments.actions';
import { getInvoices } from '@/app/actions/crm-invoices.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';

const GATEWAYS = [
  'razorpay',
  'stripe',
  'paypal',
  'manual',
  'bank-transfer',
  'cash',
  'cheque',
  'upi',
  'other',
];

export default function NewPaymentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [offlineMethods, setOfflineMethods] = useState<any[]>([]);

  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [gateway, setGateway] = useState('manual');
  const [paidOn, setPaidOn] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [transactionId, setTransactionId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [offlineMethodId, setOfflineMethodId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [createTxn, setCreateTxn] = useState(true);

  useEffect(() => {
    (async () => {
      const inv = await getInvoices(1, 100);
      setInvoices(inv.invoices || []);
      const b = await getCrmPaymentAccounts();
      setBanks((b || []).filter((x: any) => x.accountType === 'bank'));
      const m = await getOfflinePaymentMethods();
      setOfflineMethods(m || []);
    })();
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordPayment({
        invoiceId,
        amount: Number(amount),
        gateway: gateway as any,
        paidOn,
        transactionId,
        bankAccountId,
        offlineMethodId,
        remarks,
        createBankTransaction: createTxn,
      });
      if (res.error) {
        toast({
          title: 'Failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Payment recorded',
        description: `Invoice status: ${res.status || 'updated'}`,
      });
      router.push('/dashboard/crm/sales/payments');
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Record Payment"
        subtitle="Log a payment against an invoice and optionally post a bank transaction."
        icon={CreditCard}
        actions={
          <Link href="/dashboard/crm/sales/payments">
            <ClayButton
              variant="ghost"
              leading={<ChevronLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      <form onSubmit={onSubmit}>
        <ClayCard>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="invoice_id" className="text-[12.5px]">
                Invoice
              </Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger
                  id="invoice_id"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                >
                  <SelectValue placeholder="Pick an invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv._id} value={inv._id}>
                      {inv.invoiceNumber || inv._id} —{' '}
                      {inv.accountName || 'Client'} ({inv.total || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount" className="text-[12.5px]">
                Amount *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="gateway" className="text-[12.5px]">
                Gateway / Method
              </Label>
              <Select value={gateway} onValueChange={setGateway}>
                <SelectTrigger
                  id="gateway"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATEWAYS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paid_on" className="text-[12.5px]">
                Paid on
              </Label>
              <Input
                id="paid_on"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="transaction_id" className="text-[12.5px]">
                Transaction ID
              </Label>
              <Input
                id="transaction_id"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div>
              <Label htmlFor="bank_account_id" className="text-[12.5px]">
                Bank Account
              </Label>
              <Select
                value={bankAccountId}
                onValueChange={(v) => setBankAccountId(v === 'none' ? '' : v)}
              >
                <SelectTrigger
                  id="bank_account_id"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                >
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(gateway === 'manual' ||
              gateway === 'other' ||
              gateway === 'cash' ||
              gateway === 'cheque') && (
              <div>
                <Label htmlFor="offline_method_id" className="text-[12.5px]">
                  Offline Method
                </Label>
                <Select
                  value={offlineMethodId}
                  onValueChange={(v) =>
                    setOfflineMethodId(v === 'none' ? '' : v)
                  }
                >
                  <SelectTrigger
                    id="offline_method_id"
                    className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                  >
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {offlineMethods.map((m: any) => (
                      <SelectItem key={m._id} value={m._id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="md:col-span-2">
              <Label htmlFor="remarks" className="text-[12.5px]">
                Remarks
              </Label>
              <Textarea
                id="remarks"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-[12.5px] text-clay-ink">
                <input
                  type="checkbox"
                  checked={createTxn}
                  onChange={(e) => setCreateTxn(e.target.checked)}
                  className="h-4 w-4 accent-clay-rose"
                />
                Also create a bank-transaction entry for this payment
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isPending || !invoiceId || !amount}
              leading={
                isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Record Payment
            </ClayButton>
          </div>
        </ClayCard>
      </form>
    </div>
  );
}
