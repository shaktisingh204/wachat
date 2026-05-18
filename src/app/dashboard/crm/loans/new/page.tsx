'use client';

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
import {
  useActionState,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  Save,
  LoaderCircle,
  HandCoins } from 'lucide-react';
import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { saveLoan } from '@/app/actions/crm-loans.actions';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

export const dynamic = 'force-dynamic';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save loan'}
    </ZoruButton>
  );
}

const LOAN_TYPES = [
  { value: 'employee_advance', label: 'Employee Advance' },
  { value: 'customer_loan', label: 'Customer Loan' },
  { value: 'vendor_advance', label: 'Vendor Advance' },
] as const;

const initialState = { message: '', error: '' };

function borrowerEntityForType(type: string): EntityKey {
  if (type === 'employee_advance') return 'employee';
  if (type === 'vendor_advance') return 'vendor';
  return 'client';
}

export default function NewLoanPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(saveLoan, initialState);
  const [loanType, setLoanType] = useState<string>('customer_loan');

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Loan created', description: state.message });
      router.push('/dashboard/crm/loans');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Loan"
        subtitle="Disburse an employee advance, customer or vendor loan."
        icon={HandCoins}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/loans">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Loan Type */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="type">Loan Type</ZoruLabel>
            <ZoruSelect name="type" value={loanType} onValueChange={setLoanType}>
              <ZoruSelectTrigger id="type" className="w-full max-w-xs">
                <ZoruSelectValue placeholder="Select type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {LOAN_TYPES.map((t) => (
                  <ZoruSelectItem key={t.value} value={t.value}>
                    {t.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          {/* Borrower */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel>
              Borrower <span className="text-red-500">*</span>
            </ZoruLabel>
            <EntityFormField
              entity={borrowerEntityForType(loanType)}
              name="borrowerId"
              dualWriteName="borrowerName"
              required
              placeholder="Select borrower…"
            />
          </div>

          {/* Principal Amount */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="principal">
              Principal Amount (₹) <span className="text-red-500">*</span>
            </ZoruLabel>
            <ZoruInput
              id="principal"
              name="principal"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 50000"
              required
              className="max-w-xs"
            />
          </div>

          {/* Interest Rate */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="interestRate">Interest Rate (%)</ZoruLabel>
            <ZoruInput
              id="interestRate"
              name="interestRate"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 12"
              defaultValue="0"
              className="max-w-xs"
            />
          </div>

          {/* Tenure */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="tenureMonths">Tenure (months)</ZoruLabel>
            <ZoruInput
              id="tenureMonths"
              name="tenureMonths"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 12"
              defaultValue="12"
              className="max-w-xs"
            />
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="startDate">Start Date</ZoruLabel>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="flex h-9 w-full max-w-xs rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Any additional details about this loan…"
              className="max-w-lg"
            />
          </div>

          {state.error && (
            <p className="text-[13px] text-red-500">{state.error}</p>
          )}

          <div className="flex items-center gap-3">
            <SubmitButton />
            <ZoruButton variant="ghost" size="sm" asChild>
              <Link href="/dashboard/crm/loans">Cancel</Link>
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
