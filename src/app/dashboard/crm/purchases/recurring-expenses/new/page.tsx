'use client';

/**
 * Create recurring expense — `/dashboard/crm/purchases/recurring-expenses/new`.
 *
 * Bill-shaped form (header + vendor + amount + recurring config). Posts
 * to `saveRecurringExpense` — preserves the existing FormData keys
 * (`name`, `amount`, `currency`, `vendor`, `category_id`,
 * `category_name`, `frequency`, `frequency_count`, `start_date`,
 * `until_date`, `stop_at_count`, `payment_method`, `notes`, `status`).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Repeat } from 'lucide-react';

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
import { EntityFormField } from '@/components/crm/entity-form-field';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { saveRecurringExpense } from '@/app/actions/worksuite/billing.actions';

const INITIAL_STATE = { message: '', error: '' } as {
  message?: string;
  error?: string;
  id?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Create schedule
    </ZoruButton>
  );
}

export default function NewRecurringExpensePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(
    saveRecurringExpense,
    INITIAL_STATE,
  );

  const [frequency, setFrequency] = useState<
    'days' | 'weeks' | 'months' | 'years'
  >('months');
  const startDate = new Date().toISOString().slice(0, 10);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/purchases/recurring-expenses');
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-6"
      onChange={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
    >
      <DirtyFormPrompt dirty={dirty} />

      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="status" value="active" />

      <CrmPageHeader
        title="New recurring expense"
        subtitle="Schedule an expense to record automatically."
        icon={Repeat}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Purchases', href: '/dashboard/crm/purchases' },
          {
            label: 'Recurring Expenses',
            href: '/dashboard/crm/purchases/recurring-expenses',
          },
          { label: 'New' },
        ]}
      />

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Schedule details
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <ZoruLabel className="text-foreground">
              Name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput name="name" required placeholder="e.g. AWS hosting" />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Currency</ZoruLabel>
            <EntityFormField entity="currency" name="currency" initialId="INR" />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">
              Amount <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput name="amount" type="number" step="0.01" required />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Vendor</ZoruLabel>
            <EntityFormField
              entity="vendor"
              name="vendor_id"
              dualWriteName="vendor"
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Category</ZoruLabel>
            <EntityFormField
              entity="category"
              name="category_id"
              dualWriteName="category_name"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Recurrence
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Every</ZoruLabel>
            <ZoruInput
              name="frequency_count"
              type="number"
              min={1}
              defaultValue={1}
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Frequency</ZoruLabel>
            <ZoruSelect
              value={frequency}
              onValueChange={(v) =>
                setFrequency(v as 'days' | 'weeks' | 'months' | 'years')
              }
            >
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
            <ZoruLabel className="text-foreground">
              Start date <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              name="start_date"
              type="date"
              defaultValue={startDate}
              required
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Until date</ZoruLabel>
            <ZoruInput name="until_date" type="date" />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Stop after N runs</ZoruLabel>
            <ZoruInput name="stop_at_count" type="number" min={0} />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-foreground">Payment method</ZoruLabel>
            <ZoruInput
              name="payment_method"
              placeholder="Cash, Card, Bank, …"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Notes
        </h3>
        <ZoruTextarea name="notes" rows={3} />
      </ZoruCard>

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-zoru-line bg-zoru-bg px-2 py-3">
        <ZoruButton variant="outline" asChild>
          <Link href="/dashboard/crm/purchases/recurring-expenses">
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton />
      </div>
    </form>
  );
}
