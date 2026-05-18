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
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

export const dynamic = 'force-dynamic';

import { ArrowLeft, Save, LoaderCircle, Target } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { saveBudget } from '@/app/actions/crm-budgets.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

const initialState = { message: '', error: '' };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Save Budget
    </ZoruButton>
  );
}

type HeadType = 'account' | 'department' | 'project';

export default function NewBudgetPage() {
  const [state, formAction] = useActionState(saveBudget, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();
  const [headType, setHeadType] = useState<HeadType>('account');

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push('/dashboard/crm/budgets');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, router, toast]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Budget"
        subtitle="Set a period budget to track actuals against plan."
        icon={Target}
        actions={
          <Link href="/dashboard/crm/budgets">
            <ZoruButton variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Budgets
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="space-y-6">
          {/* Budget Head Type + Head Picker */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="budgetHeadType" className="text-zoru-ink">
                Head Type
              </ZoruLabel>
              <ZoruSelect
                name="budgetHeadType"
                value={headType}
                onValueChange={(v) => setHeadType(v as HeadType)}
              >
                <ZoruSelectTrigger id="budgetHeadType">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="account">Account</ZoruSelectItem>
                  <ZoruSelectItem value="department">Department</ZoruSelectItem>
                  <ZoruSelectItem value="project">Project</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">
                Budget Head <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <EntityFormField
                entity={headType as EntityKey}
                name="budgetHeadId"
                dualWriteName="budgetHead"
                required
                placeholder="Select head…"
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Account, department, or project for this budget.
              </p>
            </div>
          </div>

          {/* Period */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="period" className="text-zoru-ink">
                Period
              </ZoruLabel>
              <ZoruInput
                id="period"
                name="period"
                placeholder="e.g. FY2026-Q1, Apr 2026"
                maxLength={50}
              />
            </div>
            <div />
          </div>

          {/* Scenario + Plan Amount */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="scenario" className="text-zoru-ink">
                Scenario
              </ZoruLabel>
              <ZoruSelect name="scenario" defaultValue="base">
                <ZoruSelectTrigger id="scenario">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="base">Base</ZoruSelectItem>
                  <ZoruSelectItem value="best">Best</ZoruSelectItem>
                  <ZoruSelectItem value="worst">Worst</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="space-y-1.5">
              <ZoruLabel htmlFor="planAmount" className="text-zoru-ink">
                Plan Amount (₹)
              </ZoruLabel>
              <ZoruInput
                id="planAmount"
                name="planAmount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Alert At + Owner */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="alertAt" className="text-zoru-ink">
                Alert At %
              </ZoruLabel>
              <ZoruInput
                id="alertAt"
                name="alertAt"
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 80"
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Send an alert when actuals reach this % of the plan.
              </p>
            </div>

            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">
                Owner
              </ZoruLabel>
              <EntityFormField
                entity="user"
                name="ownerId"
                dualWriteName="ownerName"
                placeholder="Select owner…"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="notes" className="text-zoru-ink">
              Notes (Optional)
            </ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Any additional context for this budget…"
              maxLength={500}
            />
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
