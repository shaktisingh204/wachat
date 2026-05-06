'use client';
import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Repeat, ArrowLeft, Save, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

import { saveRecurringExpense } from '@/app/actions/worksuite/billing.actions';

const initial = { message: '', error: '' } as {
  message?: string;
  error?: string;
  id?: string;
};

export default function NewRecurringExpensePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(
    saveRecurringExpense,
    initial,
  );

  const [frequency, setFrequency] = useState<'days' | 'weeks' | 'months' | 'years'>(
    'months',
  );
  const [startDate] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/purchases/recurring-expenses');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="status" value="active" />

      <CrmPageHeader
        title="New Recurring Expense"
        subtitle="Schedule an expense to record automatically."
        icon={Repeat}
        actions={
          <>
            <Link href="/dashboard/crm/purchases/recurring-expenses">
              <ZoruButton variant="outline">
                Back
              </ZoruButton>
            </Link>
            <ZoruButton
              type="submit"
             
              disabled={isPending}
             
            >
              Save
            </ZoruButton>
          </>
        }
      />

      <ZoruCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <ZoruLabel className="text-foreground">Name</ZoruLabel>
            <ZoruInput name="name" required placeholder="e.g. AWS hosting" />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Currency</ZoruLabel>
            <ZoruInput name="currency" defaultValue="INR" maxLength={5} />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Amount</ZoruLabel>
            <ZoruInput name="amount" type="number" step="0.01" required />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Vendor</ZoruLabel>
            <ZoruInput name="vendor" />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Category</ZoruLabel>
            <ZoruInput name="category_name" placeholder="e.g. Utilities" />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Every</ZoruLabel>
            <ZoruInput name="frequency_count" type="number" min={1} defaultValue={1} />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Frequency</ZoruLabel>
            <ZoruSelect value={frequency} onValueChange={(v) => setFrequency(v as any)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="days">Days</ZoruSelectItem>
                <ZoruSelectItem value="weeks">Weeks</ZoruSelectItem>
                <ZoruSelectItem value="months">Months</ZoruSelectItem>
                <ZoruSelectItem value="years">Years</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Start Date</ZoruLabel>
            <ZoruInput name="start_date" type="date" defaultValue={startDate} />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Until Date (optional)</ZoruLabel>
            <ZoruInput name="until_date" type="date" />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Stop after N runs (optional)</ZoruLabel>
            <ZoruInput name="stop_at_count" type="number" min={0} />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Payment Method</ZoruLabel>
            <ZoruInput name="payment_method" placeholder="Cash, Card, Bank, ..." />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <ZoruLabel className="text-foreground">Notes</ZoruLabel>
            <ZoruTextarea name="notes" rows={3} />
          </div>
        </div>
      </ZoruCard>
    </form>
  );
}
