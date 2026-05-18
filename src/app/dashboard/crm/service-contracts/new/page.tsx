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
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  Save,
  LoaderCircle,
  Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { saveServiceContract } from '@/app/actions/crm-service-contracts.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string; id?: string } = {
  message: '',
  error: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save contract
    </ZoruButton>
  );
}

export default function NewServiceContractPage() {
  const [state, formAction] = useActionState(saveServiceContract, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Created', description: state.message });
      router.push('/dashboard/crm/service-contracts');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Service Contract"
        subtitle="Create an AMC or field service agreement."
        icon={Wrench}
        actions={
          <ZoruButton variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
            <Link href="/dashboard/crm/service-contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Contract No + Customer Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="contractNo">Contract No</ZoruLabel>
              <ZoruInput
                id="contractNo"
                name="contractNo"
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>Customer</ZoruLabel>
              <EntityFormField
                entity="client"
                name="customerId"
                dualWriteName="customerName"
                required
                placeholder="Select customer…"
              />
            </div>
          </div>

          {/* Row 2: Asset + Frequency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="assetName">Asset / Equipment</ZoruLabel>
              <ZoruInput
                id="assetName"
                name="assetName"
                placeholder="e.g. HVAC Unit, Generator"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="frequency">Frequency</ZoruLabel>
              <ZoruSelect name="frequency">
                <ZoruSelectTrigger id="frequency">
                  <ZoruSelectValue placeholder="Select frequency" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                  <ZoruSelectItem value="quarterly">Quarterly</ZoruSelectItem>
                  <ZoruSelectItem value="annual">Annual</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Row 3: Coverage Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="coverage">Coverage Description</ZoruLabel>
            <ZoruTextarea
              id="coverage"
              name="coverage"
              placeholder="Describe what is covered under this contract"
              rows={3}
            />
          </div>

          {/* Row 4: Start Date + End Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="periodStart">Start Date</ZoruLabel>
              <ZoruInput id="periodStart" name="periodStart" type="date" />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="periodEnd">End Date</ZoruLabel>
              <ZoruInput id="periodEnd" name="periodEnd" type="date" />
            </div>
          </div>

          {/* Row 5: Billing Amount + Technician */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="billingAmount">Billing Amount</ZoruLabel>
              <ZoruInput
                id="billingAmount"
                name="billingAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>Technician</ZoruLabel>
              <EntityFormField
                entity="employee"
                name="technicianId"
                dualWriteName="technician"
                placeholder="Select technician…"
              />
            </div>
          </div>

          {/* Row 6: Notes */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Internal notes or special instructions"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
