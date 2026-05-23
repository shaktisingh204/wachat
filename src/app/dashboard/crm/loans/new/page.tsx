'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save,
  LoaderCircle } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveLoan } from '@/app/actions/crm-loans.actions';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

export const dynamic = 'force-dynamic';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save loan'}
    </Button>
  );
}

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

  const [principal, setPrincipal] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>(0);
  const [tenureMonths, setTenureMonths] = useState<number | ''>(12);

  const calculateEmi = () => {
    if (!principal || !tenureMonths) return 0;
    const p = Number(principal);
    const r = Number(interestRate) / 12 / 100;
    const n = Number(tenureMonths);

    if (r === 0) return p / n;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const previewEmi = calculateEmi();
  const totalPayment = previewEmi * Number(tenureMonths || 0);

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
    <EntityDetailShell
      eyebrow="LOAN"
      title="New Loan"
      back={{ href: '/dashboard/crm/loans', label: 'Loans & Advances' }}
    >
      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Loan Type */}
          <div className="flex flex-col gap-1.5">
            <Label>Loan Type</Label>
            <EnumFormField
              enumName="loanType"
              name="type"
              initialId={loanType}
              onChange={(v) => setLoanType(v ?? 'customer_loan')}
            />
          </div>

          {/* Borrower */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Borrower <span className="text-red-500">*</span>
            </Label>
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
            <Label htmlFor="principal">
              Principal Amount (₹) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="principal"
              name="principal"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 50000"
              required
              className="max-w-xs"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          {/* Interest Rate */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interestRate">Interest Rate (%)</Label>
            <Input
              id="interestRate"
              name="interestRate"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 12"
              className="max-w-xs"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          {/* Tenure */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenureMonths">Tenure (months)</Label>
            <Input
              id="tenureMonths"
              name="tenureMonths"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 12"
              className="max-w-xs"
              value={tenureMonths}
              onChange={(e) => setTenureMonths(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          {/* Calculator Preview */}
          {principal && tenureMonths ? (
            <div className="max-w-xs rounded-md border border-zoru-line bg-zoru-surface/50 p-4">
              <h4 className="mb-2 text-[13px] font-medium text-zoru-ink">Repayment Preview</h4>
              <div className="flex flex-col gap-1 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Monthly EMI:</span>
                  <span className="font-mono font-medium">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(previewEmi)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Total Payment:</span>
                  <span className="font-mono">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalPayment)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zoru-line pt-1 mt-1">
                  <span className="text-zoru-ink-muted">Total Interest:</span>
                  <span className="font-mono text-zoru-danger-ink">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalPayment - Number(principal))}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Start Date</Label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="flex h-9 w-full max-w-xs rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-1 text-[13px] text-zoru-ink shadow-sm outline-none transition-colors placeholder:text-zoru-ink-muted focus:border-zoru-accent focus:ring-1 focus:ring-zoru-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/crm/loans">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
