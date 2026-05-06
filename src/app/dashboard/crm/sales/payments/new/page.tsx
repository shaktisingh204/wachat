'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, LoaderCircle, Save, ChevronLeft } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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
  const { toast } = useZoruToast();
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
            <ZoruButton variant="ghost">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </ZoruButton>
          </Link>
        }
      />

      <form onSubmit={onSubmit}>
        <ZoruCard className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel htmlFor="invoice_id" className="text-[12.5px]">
                Invoice
              </ZoruLabel>
              <ZoruSelect value={invoiceId} onValueChange={setInvoiceId}>
                <ZoruSelectTrigger id="invoice_id">
                  <ZoruSelectValue placeholder="Pick an invoice" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {invoices.map((inv) => (
                    <ZoruSelectItem key={inv._id} value={inv._id}>
                      {inv.invoiceNumber || inv._id} —{' '}
                      {inv.accountName || 'Client'} ({inv.total || 0})
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div>
              <ZoruLabel htmlFor="amount" className="text-[12.5px]">
                Amount *
              </ZoruLabel>
              <ZoruInput
                id="amount"
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <ZoruLabel htmlFor="gateway" className="text-[12.5px]">
                Gateway / Method
              </ZoruLabel>
              <ZoruSelect value={gateway} onValueChange={setGateway}>
                <ZoruSelectTrigger id="gateway">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {GATEWAYS.map((g) => (
                    <ZoruSelectItem key={g} value={g}>
                      {g}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div>
              <ZoruLabel htmlFor="paid_on" className="text-[12.5px]">
                Paid on
              </ZoruLabel>
              <ZoruInput
                id="paid_on"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>

            <div>
              <ZoruLabel htmlFor="transaction_id" className="text-[12.5px]">
                Transaction ID
              </ZoruLabel>
              <ZoruInput
                id="transaction_id"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            <div>
              <ZoruLabel htmlFor="bank_account_id" className="text-[12.5px]">
                Bank Account
              </ZoruLabel>
              <ZoruSelect
                value={bankAccountId}
                onValueChange={(v) => setBankAccountId(v === 'none' ? '' : v)}
              >
                <ZoruSelectTrigger id="bank_account_id">
                  <ZoruSelectValue placeholder="None" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="none">— None —</ZoruSelectItem>
                  {banks.map((b) => (
                    <ZoruSelectItem key={b._id} value={b._id}>
                      {b.accountName}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {(gateway === 'manual' ||
              gateway === 'other' ||
              gateway === 'cash' ||
              gateway === 'cheque') && (
              <div>
                <ZoruLabel htmlFor="offline_method_id" className="text-[12.5px]">
                  Offline Method
                </ZoruLabel>
                <ZoruSelect
                  value={offlineMethodId}
                  onValueChange={(v) =>
                    setOfflineMethodId(v === 'none' ? '' : v)
                  }
                >
                  <ZoruSelectTrigger id="offline_method_id">
                    <ZoruSelectValue placeholder="None" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="none">— None —</ZoruSelectItem>
                    {offlineMethods.map((m: any) => (
                      <ZoruSelectItem key={m._id} value={m._id}>
                        {m.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            )}

            <div className="md:col-span-2">
              <ZoruLabel htmlFor="remarks" className="text-[12.5px]">
                Remarks
              </ZoruLabel>
              <ZoruTextarea
                id="remarks"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <input
                  type="checkbox"
                  checked={createTxn}
                  onChange={(e) => setCreateTxn(e.target.checked)}
                  className="h-4 w-4"
                />
                Also create a bank-transaction entry for this payment
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <ZoruButton
              type="submit"
              disabled={isPending || !invoiceId || !amount}
            >
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
              )}
              Record Payment
            </ZoruButton>
          </div>
        </ZoruCard>
      </form>
    </div>
  );
}
