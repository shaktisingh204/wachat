'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Repeat, ArrowLeft, Save, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
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
import { saveRecurringExpense } from '@/app/actions/worksuite/billing.actions';

const initial = { message: '', error: '' } as {
  message?: string;
  error?: string;
  id?: string;
};

export default function NewRecurringExpensePage() {
  const router = useRouter();
  const { toast } = useToast();
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
              <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
                Back
              </ClayButton>
            </Link>
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isPending}
              leading={
                isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )
              }
            >
              Save
            </ClayButton>
          </>
        }
      />

      <ClayCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-foreground">Name</Label>
            <Input name="name" required placeholder="e.g. AWS hosting" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Currency</Label>
            <Input name="currency" defaultValue="INR" maxLength={5} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground">Amount</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Vendor</Label>
            <Input name="vendor" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Category</Label>
            <Input name="category_name" placeholder="e.g. Utilities" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground">Every</Label>
            <Input name="frequency_count" type="number" min={1} defaultValue={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="years">Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Start Date</Label>
            <Input name="start_date" type="date" defaultValue={startDate} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground">Until Date (optional)</Label>
            <Input name="until_date" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Stop after N runs (optional)</Label>
            <Input name="stop_at_count" type="number" min={0} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Payment Method</Label>
            <Input name="payment_method" placeholder="Cash, Card, Bank, ..." />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-foreground">Notes</Label>
            <Textarea name="notes" rows={3} />
          </div>
        </div>
      </ClayCard>
    </form>
  );
}
